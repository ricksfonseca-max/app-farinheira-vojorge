"""Regras do serviço: junta leituras do CLP, amostras do app, modelo e banco."""

from __future__ import annotations

import math
import threading
from datetime import datetime, timedelta, timezone
from typing import Callable

from . import modelo
from .aprendizado import EstimativaK, estimar_k
from .banco import Banco, de_iso, iso, json_avisos
from .config import ConfigServico, ParametrosForno, normalizar_forno
from .modelo import EstadoControle, LeituraProcesso, Sugestao
from .vapor import tsat_pressao_manometrica

ACOES_AVALIAVEIS = {modelo.AUMENTAR, modelo.REDUZIR, modelo.MANTER}


def ler_data(valor, fuso_padrao: timezone) -> datetime | None:
    """Aceita ISO (com ou sem fuso), 'AAAA-MM-DD HH:MM:SS' ou epoch (s/ms)."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, (int, float)):
        seg = valor / 1000 if valor > 1e11 else valor
        return datetime.fromtimestamp(seg, tz=timezone.utc)
    texto = str(valor).strip()
    if texto.endswith("Z"):
        texto = texto[:-1] + "+00:00"
    dt = datetime.fromisoformat(texto)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=fuso_padrao)
    return dt.astimezone(timezone.utc)


class ServicoUmidade:
    def __init__(
        self,
        cfg: ConfigServico,
        fornos: dict[str, ParametrosForno],
        banco: Banco,
        relogio: Callable[[], datetime] | None = None,
    ):
        self.cfg = cfg
        self.fornos = fornos
        self.banco = banco
        self.relogio = relogio or (lambda: datetime.now(timezone.utc))
        self._trava = threading.RLock()
        self._leituras: dict[str, LeituraProcesso] = {}
        self._ultima_sug_gravada: dict[str, tuple[str, float | None]] = {}
        self.ultima_coleta_ok: datetime | None = None
        self.ultimo_erro_coleta: str | None = None

    # ------------------------------------------------------------------ estado
    def _carregar_estado(self, forno: str) -> tuple[EstadoControle, float | None]:
        r = self.banco.um("SELECT * FROM estado_forno WHERE forno = ?", (forno,))
        if not r:
            return EstadoControle(), None
        est = EstadoControle(
            base_alvo_hz=r["base_alvo_hz"],
            fator_ref=r["fator_ref"],
            definido_em=de_iso(r["definido_em"]),
            ultima_amostra_em=de_iso(r["ultima_amostra_em"]),
            ultima_mudanca_velocidade_em=de_iso(r["ultima_mudanca_velocidade_em"]),
        )
        return est, r["velocidade_referencia_hz"]

    def _salvar_estado(self, forno: str, est: EstadoControle, v_ref: float | None) -> None:
        self.banco.executar(
            """INSERT INTO estado_forno (forno, base_alvo_hz, fator_ref, definido_em,
                   ultima_amostra_em, ultima_mudanca_velocidade_em, velocidade_referencia_hz)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (forno) DO UPDATE SET
                   base_alvo_hz = excluded.base_alvo_hz,
                   fator_ref = excluded.fator_ref,
                   definido_em = excluded.definido_em,
                   ultima_amostra_em = excluded.ultima_amostra_em,
                   ultima_mudanca_velocidade_em = excluded.ultima_mudanca_velocidade_em,
                   velocidade_referencia_hz = excluded.velocidade_referencia_hz""",
            (forno, est.base_alvo_hz, est.fator_ref, iso(est.definido_em), iso(est.ultima_amostra_em),
             iso(est.ultima_mudanca_velocidade_em), v_ref),
        )

    # --------------------------------------------------------------- leituras
    def registrar_leitura(
        self,
        forno: str,
        velocidade_hz: float | None,
        pressao_bar: float | None,
        rodando: bool,
        lido_em: datetime | None = None,
    ) -> bool:
        nome = normalizar_forno(forno, self.fornos)
        if nome is None:
            return False
        p = self.fornos[nome]
        lido_em = lido_em or self.relogio()
        with self._trava:
            tsat = tsat_pressao_manometrica(pressao_bar)
            self.banco.inserir("leituras", {
                "forno": nome, "lido_em": iso(lido_em), "velocidade_hz": velocidade_hz,
                "pressao_bar": pressao_bar, "tsat_c": tsat, "rodando": int(bool(rodando)),
            })
            self._leituras[nome] = LeituraProcesso(velocidade_hz, pressao_bar, bool(rodando), lido_em)

            # Detecta mudança de rotação (começa a contar o tempo de espera).
            # v_ref: None = desconhecido (serviço acabou de iniciar), 0 = forno estava parado.
            est, v_ref = self._carregar_estado(nome)
            mudou_em = est.ultima_mudanca_velocidade_em
            parado = (not rodando) or velocidade_hz is None or velocidade_hz < 1.0
            if parado:
                if v_ref not in (None, 0.0):
                    mudou_em = lido_em
                v_ref = 0.0
            elif v_ref is None:
                v_ref = velocidade_hz
            elif v_ref == 0.0 or abs(velocidade_hz - v_ref) >= p.limiar_mudanca_hz:
                mudou_em = lido_em
                v_ref = velocidade_hz
            est = EstadoControle(est.base_alvo_hz, est.fator_ref, est.definido_em,
                                 est.ultima_amostra_em, mudou_em)
            self._salvar_estado(nome, est, v_ref)
        return True

    def leitura(self, forno: str) -> LeituraProcesso | None:
        return self._leituras.get(forno)

    # ---------------------------------------------------------------- amostras
    def _estatisticas_janela(self, forno: str, coletada_em: datetime) -> dict:
        """Rotação e vapor enquanto a massa desta amostra estava dentro do forno."""
        p = self.fornos[forno]
        fim = coletada_em - timedelta(minutes=p.t_coleta_min)
        ini = fim - timedelta(minutes=p.t_residencia_min)
        linhas = self.banco.consultar(
            """SELECT velocidade_hz, tsat_c, rodando FROM leituras
               WHERE forno = ? AND lido_em >= ? AND lido_em <= ?""",
            (forno, iso(ini), iso(fim)),
        )
        validas = [r for r in linhas if r["rodando"] and r["velocidade_hz"] is not None]
        fatores = [modelo.fator_vapor(r["tsat_c"], p) for r in validas]
        pares = [(r["velocidade_hz"], f) for r, f in zip(validas, fatores) if f is not None]
        n = len(pares)
        esperado = p.t_residencia_min * 60 / max(self.cfg.intervalo_leitura_s, 1)
        if n < 3:
            return {"v_media_janela": None, "fator_media_janela": None, "v_desvio_janela": None,
                    "base_media_janela": None, "base_desvio_janela": None,
                    "n_leituras_janela": n, "janela_estavel": 0, "_aviso": None}

        def media_desvio(xs):
            m = sum(xs) / len(xs)
            return m, math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))

        v_media, v_desvio = media_desvio([v for v, _ in pares])
        base_media, base_desvio = media_desvio([v / f for v, f in pares])
        cobertura_ok = n >= 0.5 * esperado and len(validas) == len(linhas)
        estavel = int(base_desvio < 1.0 and cobertura_ok)
        aviso = None
        if base_desvio >= 1.0:
            aviso = "Rotação/vapor variaram enquanto esta massa estava no forno: correção aproximada."
        elif not cobertura_ok:
            aviso = "Histórico de rotação incompleto para esta amostra (falha de leitura ou parada)."
        return {"v_media_janela": v_media, "fator_media_janela": sum(f for _, f in pares) / n,
                "v_desvio_janela": v_desvio, "base_media_janela": base_media,
                "base_desvio_janela": base_desvio, "n_leituras_janela": n, "janela_estavel": estavel,
                "_aviso": aviso}

    def _leitura_proxima(self, forno: str, quando: datetime) -> dict | None:
        ini, fim = quando - timedelta(minutes=2), quando + timedelta(minutes=2)
        linhas = self.banco.consultar(
            "SELECT * FROM leituras WHERE forno = ? AND lido_em BETWEEN ? AND ?",
            (forno, iso(ini), iso(fim)),
        )
        if not linhas:
            return None
        return min(linhas, key=lambda r: abs((de_iso(r["lido_em"]) - quando).total_seconds()))

    def processar_amostra(
        self,
        forno: str,
        umidade: float,
        coletada_em: datetime | None = None,
        origem: str = "app",
        tipo_farinha: str | None = None,
        peneira: str | None = None,
        responsavel: str | None = None,
        registro_id: str | None = None,
    ) -> dict:
        nome = normalizar_forno(forno, self.fornos)
        if nome is None:
            raise ValueError(f"Forno desconhecido: {forno!r}. Configurados: {list(self.fornos)}")
        try:
            umidade = float(umidade)
        except (TypeError, ValueError):
            raise ValueError(f"Umidade inválida: {umidade!r}") from None
        if not math.isfinite(umidade):
            raise ValueError("Umidade inválida")

        p = self.fornos[nome]
        agora = self.relogio()
        coletada_em = coletada_em or agora
        if coletada_em > agora + timedelta(minutes=5):
            raise ValueError("Data da amostra está no futuro. Confira o relógio do aparelho.")
        minuto = coletada_em.astimezone(timezone.utc).replace(second=0, microsecond=0)
        chave = f"{iso(minuto)}|{umidade:.2f}"

        with self._trava:
            existente = self.banco.um("SELECT id FROM amostras WHERE forno = ? AND chave = ?", (nome, chave))
            if existente:
                sug = self.banco.um(
                    "SELECT * FROM sugestoes WHERE amostra_id = ? ORDER BY id DESC LIMIT 1", (existente["id"],))
                return {"amostra_id": existente["id"], "duplicada": True, "sugestao": _sug_de_linha(sug)}

            janela = self._estatisticas_janela(nome, coletada_em)
            aviso_janela = janela.pop("_aviso")
            no_momento = self._leitura_proxima(nome, coletada_em) or {}
            amostra_id = self.banco.inserir("amostras", {
                "forno": nome, "coletada_em": iso(coletada_em), "umidade": umidade, "origem": origem,
                "chave": chave, "tipo_farinha": tipo_farinha, "peneira": peneira,
                "responsavel": responsavel, "registro_id": None if registro_id is None else str(registro_id),
                "velocidade_hz": no_momento.get("velocidade_hz"), "pressao_bar": no_momento.get("pressao_bar"),
                "tsat_c": no_momento.get("tsat_c"), "recebida_em": iso(agora), **janela,
            })

            est, v_ref = self._carregar_estado(nome)
            if est.ultima_amostra_em is not None and coletada_em <= est.ultima_amostra_em:
                # Apontamento atrasado (ex.: sincronização): guarda para análise, sem corrigir.
                return {"amostra_id": amostra_id, "duplicada": False, "sugestao": None,
                        "observacao": "Amostra mais antiga que a última: guardada só para análise."}

            k = self.ganho_k(nome)
            sug, novo = modelo.sugerir_por_amostra(
                p, self._leituras.get(nome), est, umidade, coletada_em, agora, k, self.cfg.leitura_validade_s,
                base_janela_hz=janela["base_media_janela"], aviso_janela=aviso_janela)
            self._salvar_estado(nome, novo, v_ref)
            self._gravar_sugestao(sug, amostra_id)
            self._ultima_sug_gravada[nome] = (sug.acao, sug.velocidade_sugerida_hz)
            return {"amostra_id": amostra_id, "duplicada": False, "sugestao": sug.como_dict()}

    def sincronizar_registros(self, registros: list[dict]) -> int:
        """Importa apontamentos do Node-RED que não chegaram pelo app (rede caiu, etc.)."""
        agora = self.relogio()
        limite = agora - timedelta(hours=self.cfg.sync_janela_horas)
        novos = 0
        for r in sorted(registros, key=lambda r: str(r.get("data_hora") or "")):
            try:
                nome = normalizar_forno(r.get("forno"), self.fornos)
                quando = ler_data(r.get("data_hora"), self.cfg.fuso_padrao)
                if nome is None or quando is None or quando < limite or r.get("umidade") in (None, ""):
                    continue
                res = self.processar_amostra(
                    nome, float(r["umidade"]), quando, origem="sync",
                    tipo_farinha=r.get("tipo_farinha"), peneira=r.get("peneira"),
                    responsavel=r.get("responsavel"), registro_id=r.get("id"))
                novos += 0 if res["duplicada"] else 1
            except (ValueError, TypeError):
                continue
        return novos

    # -------------------------------------------------------------- sugestões
    def ganho_k(self, forno: str) -> float:
        p = self.fornos[forno]
        if p.usar_k_aprendido:
            est = self.estimativa_k(forno)
            if est.confiavel and est.k is not None:
                return est.k
        return p.ganho_k

    def estimativa_k(self, forno: str) -> EstimativaK:
        p = self.fornos[forno]
        linhas = self.banco.consultar(
            """SELECT umidade, base_media_janela FROM amostras
               WHERE forno = ? AND janela_estavel = 1 AND base_media_janela > 0
                 AND umidade BETWEEN ? AND ?
               ORDER BY coletada_em DESC LIMIT 300""",
            (forno, p.umidade_min_valida, p.umidade_max_valida),
        )
        pontos = [(r["base_media_janela"], r["umidade"]) for r in linhas]
        return estimar_k(pontos)

    def _ultima_umidade(self, forno: str) -> dict | None:
        return self.banco.um(
            "SELECT * FROM amostras WHERE forno = ? ORDER BY coletada_em DESC LIMIT 1", (forno,))

    def sugestao_atual(self, forno: str) -> Sugestao:
        p = self.fornos[forno]
        est, _ = self._carregar_estado(forno)
        ultima = self._ultima_umidade(forno)
        sug = modelo.sugerir_por_vapor(
            p, self._leituras.get(forno), est, self.relogio(), self.cfg.leitura_validade_s,
            ultima["umidade"] if ultima else None)
        sug.ganho_k = self.ganho_k(forno)
        return sug

    def _gravar_sugestao(self, sug: Sugestao, amostra_id: int | None = None) -> int:
        return self.banco.inserir("sugestoes", {
            "forno": sug.forno, "calculada_em": iso(sug.calculada_em), "origem": sug.origem,
            "acao": sug.acao, "motivo": sug.motivo, "velocidade_atual_hz": sug.velocidade_atual_hz,
            "velocidade_sugerida_hz": sug.velocidade_sugerida_hz, "pressao_bar": sug.pressao_bar,
            "tsat_c": sug.tsat_c, "fator_vapor": sug.fator_vapor, "umidade": sug.umidade,
            "umidade_alvo": sug.umidade_alvo, "erro": sug.erro, "delta_hz": sug.delta_hz,
            "ganho_k": sug.ganho_k, "amostra_id": amostra_id, "avisos": json_avisos(sug.avisos),
        })

    def atualizar_sugestoes_vapor(self) -> None:
        """Grava a sugestão ao vivo quando ela muda (ação ou ≥ limiar de Hz)."""
        with self._trava:
            for nome, p in self.fornos.items():
                sug = self.sugestao_atual(nome)
                anterior = self._ultima_sug_gravada.get(nome)
                if anterior is not None:
                    acao_ant, f_ant = anterior
                    f_nova = sug.velocidade_sugerida_hz
                    igual = acao_ant == sug.acao and (
                        f_ant is None or f_nova is None or abs(f_nova - f_ant) < p.limiar_mudanca_hz)
                    if igual:
                        continue
                self._gravar_sugestao(sug)
                self._ultima_sug_gravada[nome] = (sug.acao, sug.velocidade_sugerida_hz)

    def verificar_aplicacao(self) -> int:
        """Marca se o operador seguiu cada sugestão (olhando a rotação real depois)."""
        agora = self.relogio()
        janela = timedelta(minutes=self.cfg.janela_aplicacao_min)
        pendentes = self.banco.consultar(
            "SELECT * FROM sugestoes WHERE aplicada IS NULL AND calculada_em <= ?", (iso(agora - janela),))
        for s in pendentes:
            aplicada, v_apos = -1, None
            if s["acao"] in ACOES_AVALIAVEIS and s["velocidade_atual_hz"] is not None:
                ini = de_iso(s["calculada_em"])
                linhas = self.banco.consultar(
                    """SELECT velocidade_hz FROM leituras WHERE forno = ? AND lido_em > ? AND lido_em <= ?
                       AND velocidade_hz IS NOT NULL ORDER BY lido_em""",
                    (s["forno"], iso(ini), iso(ini + janela)),
                )
                if linhas:
                    v_apos = linhas[-1]["velocidade_hz"]
                    lim = self.fornos[s["forno"]].limiar_mudanca_hz if s["forno"] in self.fornos else 0.5
                    desejado = s["velocidade_sugerida_hz"] - s["velocidade_atual_hz"]
                    movido = v_apos - s["velocidade_atual_hz"]
                    if abs(desejado) < lim:
                        aplicada = int(abs(movido) < lim)
                    else:
                        aplicada = int(movido / desejado >= 0.5)
            self.banco.executar(
                "UPDATE sugestoes SET aplicada = ?, velocidade_apos_hz = ?, verificada_em = ? WHERE id = ?",
                (aplicada, v_apos, iso(agora), s["id"]),
            )
        return len(pendentes)

    # ------------------------------------------------------------------ painel
    def estado_forno(self, nome: str) -> dict:
        p = self.fornos[nome]
        leitura = self._leituras.get(nome)
        est, _ = self._carregar_estado(nome)
        ultima = self._ultima_umidade(nome)
        sug = self.sugestao_atual(nome)
        proxima = None
        if est.ultima_amostra_em:
            proxima = iso(est.ultima_amostra_em + timedelta(minutes=p.intervalo_amostra_min))
        return {
            "forno": nome,
            "leitura": None if leitura is None else {
                "velocidade_hz": leitura.velocidade_hz,
                "pressao_bar": leitura.pressao_bar,
                "tsat_c": _arred(tsat_pressao_manometrica(leitura.pressao_bar), 2),
                "rodando": leitura.rodando,
                "lido_em": iso(leitura.lido_em),
            },
            "ultima_amostra": None if ultima is None else {
                "umidade": ultima["umidade"], "coletada_em": ultima["coletada_em"],
                "responsavel": ultima["responsavel"], "tipo_farinha": ultima["tipo_farinha"],
            },
            "proxima_amostra_em": proxima,
            "sugestao": sug.como_dict(),
            "parametros": {
                "umidade_alvo": p.umidade_alvo, "banda_morta": p.banda_morta,
                "f_min_hz": p.f_min_hz, "f_max_hz": p.f_max_hz,
                "ganho_k": p.ganho_k, "usar_k_aprendido": p.usar_k_aprendido,
                "t_residencia_min": p.t_residencia_min, "intervalo_amostra_min": p.intervalo_amostra_min,
            },
            "modelo": self.estimativa_k(nome).como_dict(),
        }

    def estado_geral(self) -> dict:
        with self._trava:
            return {
                "agora": iso(self.relogio()),
                "coleta": {"ultima_ok": iso(self.ultima_coleta_ok), "ultimo_erro": self.ultimo_erro_coleta},
                "fornos": [self.estado_forno(n) for n in self.fornos],
            }


def _arred(v: float | None, casas: int) -> float | None:
    return None if v is None else round(v, casas)


def _sug_de_linha(linha: dict | None) -> dict | None:
    if linha is None:
        return None
    import json
    d = dict(linha)
    d["avisos"] = json.loads(d["avisos"] or "[]")
    return d
