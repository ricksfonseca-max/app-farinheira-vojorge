"""Regras do serviço: junta leituras do CLP, amostras do app, modelo e banco."""

from __future__ import annotations

import hmac
import math
import threading
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Callable

from . import modelo
from .aprendizado import EstimativaK, estimar_k
from .banco import Banco, de_iso, iso, json_avisos
from .config import ConfigServico, ParametrosForno, normalizar_forno
from .modelo import EstadoControle, LeituraProcesso, Sugestao
from .vapor import tsat_pressao_manometrica

ACOES_AVALIAVEIS = {modelo.AUMENTAR, modelo.REDUZIR, modelo.MANTER}
MODOS = ("linha_base", "conselheiro")
TEXTO_MODO = {"linha_base": "Linha de base", "conselheiro": "Conselheiro"}


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
        # Registra o início da coleta: é o marco zero do comparativo "antes × depois".
        if self.banco.um("SELECT id FROM modos LIMIT 1") is None:
            inicial = cfg.modo_inicial if cfg.modo_inicial in MODOS else "linha_base"
            self.banco.inserir("modos", {"modo": inicial, "alterado_por": "sistema",
                                         "motivo": "início da coleta", "alterado_em": iso(self.relogio())})

    # ------------------------------------------------------ setpoint e modo
    def params(self, forno: str) -> ParametrosForno:
        """Parâmetros do forno com o setpoint em vigor (o da tela vence o do fornos.json)."""
        p = self.fornos[forno]
        r = self.banco.um(
            "SELECT umidade_alvo FROM setpoints WHERE forno = ? ORDER BY id DESC LIMIT 1", (forno,))
        return replace(p, umidade_alvo=r["umidade_alvo"]) if r else p

    def setpoint_atual(self, forno: str) -> dict:
        r = self.banco.um("SELECT * FROM setpoints WHERE forno = ? ORDER BY id DESC LIMIT 1", (forno,))
        if r:
            return {"umidade_alvo": r["umidade_alvo"], "alterado_em": r["alterado_em"],
                    "alterado_por": r["alterado_por"], "origem": "tela"}
        return {"umidade_alvo": self.fornos[forno].umidade_alvo, "alterado_em": None,
                "alterado_por": None, "origem": "configuracao"}

    def conferir_pin(self, pin) -> bool:
        if not self.cfg.senha_supervisor:
            return True
        return hmac.compare_digest(str(pin or "").encode(), self.cfg.senha_supervisor.encode())

    def alterar_setpoint(self, forno: str, valor, usuario: str | None, motivo: str | None = None) -> dict:
        nome = normalizar_forno(forno, self.fornos)
        if nome is None:
            raise ValueError(f"Forno desconhecido: {forno!r}")
        base = self.fornos[nome]
        try:
            valor = round(float(str(valor).replace(",", ".")), 2)
        except (TypeError, ValueError):
            raise ValueError("Setpoint inválido") from None
        if not (base.setpoint_min <= valor <= base.setpoint_max):
            raise ValueError(f"Setpoint deve ficar entre {base.setpoint_min:g} e {base.setpoint_max:g} %".replace(".", ","))
        usuario = (usuario or "").strip()[:60]
        if not usuario:
            raise ValueError("Informe quem está alterando o setpoint")
        with self._trava:
            agora = self.relogio()
            self.banco.inserir("setpoints", {"forno": nome, "umidade_alvo": valor, "alterado_por": usuario,
                                             "motivo": (motivo or "").strip()[:200] or None,
                                             "alterado_em": iso(agora)})
            self._reaplicar_ultima_amostra(nome, agora, valor)
            return self.estado_forno(nome)

    def _reaplicar_ultima_amostra(self, nome: str, agora: datetime, novo_alvo: float) -> None:
        """Com setpoint novo, refaz a correção da última amostra (se ainda for recente)."""
        ultima = self._ultima_umidade(nome)
        if not ultima:
            return
        est, v_ref = self._carregar_estado(nome)
        sug, novo = modelo.sugerir_por_amostra(
            self.params(nome), self._leituras.get(nome), est, ultima["umidade"], de_iso(ultima["coletada_em"]),
            agora, self.ganho_k(nome), self.cfg.leitura_validade_s, base_janela_hz=ultima["base_media_janela"])
        if sug.acao in (modelo.AMOSTRA_ANTIGA, modelo.AMOSTRA_INVALIDA):
            return
        sug.origem = "setpoint"
        sug.motivo = f"Setpoint alterado para {novo_alvo:.1f}%. ".replace(".", ",", 1) + sug.motivo
        self._salvar_estado(nome, novo, v_ref)
        self._gravar_sugestao(sug, ultima["id"])
        self._ultima_sug_gravada[nome] = (sug.acao, sug.velocidade_sugerida_hz)

    def modo_atual(self) -> dict:
        r = self.banco.um("SELECT * FROM modos ORDER BY id DESC LIMIT 1")
        modo = r["modo"] if r else "linha_base"
        return {"modo": modo, "texto": TEXTO_MODO.get(modo, modo),
                "alterado_em": r["alterado_em"] if r else None, "alterado_por": r["alterado_por"] if r else None}

    def alterar_modo(self, modo: str, usuario: str | None, motivo: str | None = None) -> dict:
        if modo not in MODOS:
            raise ValueError(f"Modo inválido. Use: {', '.join(MODOS)}")
        usuario = (usuario or "").strip()[:60]
        if not usuario:
            raise ValueError("Informe quem está alterando o modo")
        with self._trava:
            if self.modo_atual()["modo"] != modo:
                self.banco.inserir("modos", {"modo": modo, "alterado_por": usuario,
                                             "motivo": (motivo or "").strip()[:200] or None,
                                             "alterado_em": iso(self.relogio())})
            return self.modo_atual()

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
        temp_saida_c: float | None = None,
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
                "temp_saida_c": temp_saida_c,
            })
            self._leituras[nome] = LeituraProcesso(velocidade_hz, pressao_bar, bool(rodando), lido_em, temp_saida_c)

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

        p = self.params(nome)
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
                "tsat_c": no_momento.get("tsat_c"), "temp_saida_c": no_momento.get("temp_saida_c"),
                "umidade_alvo": p.umidade_alvo, "modo": self.modo_atual()["modo"],
                "recebida_em": iso(agora), **janela,
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
            return {"amostra_id": amostra_id, "duplicada": False, "sugestao": sug.como_dict(),
                    "modo": self.modo_atual()["modo"]}

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
        p = self.params(forno)
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
            "modo": self.modo_atual()["modo"],
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
        p = self.params(nome)
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
                "temp_saida_c": leitura.temp_saida_c,
            },
            "setpoint": self.setpoint_atual(nome),
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
                "setpoint_min": p.setpoint_min, "setpoint_max": p.setpoint_max,
                "faixa_qualidade": p.faixa_qualidade,
            },
            "modelo": self.estimativa_k(nome).como_dict(),
        }

    def estado_geral(self) -> dict:
        with self._trava:
            return {
                "agora": iso(self.relogio()),
                "coleta": {"ultima_ok": iso(self.ultima_coleta_ok), "ultimo_erro": self.ultimo_erro_coleta},
                "modo": self.modo_atual(),
                "pin_exigido": bool(self.cfg.senha_supervisor),
                "fornos": [self.estado_forno(n) for n in self.fornos],
            }

    # ---------------------------------------------------------------- séries
    def _valor_em(self, tabela: str, coluna: str, quando: datetime, forno: str | None = None):
        sql = f"SELECT {coluna} FROM {tabela} WHERE alterado_em <= ?"
        params: list = [iso(quando)]
        if forno:
            sql += " AND forno = ?"
            params.append(forno)
        r = self.banco.um(sql + " ORDER BY alterado_em DESC, id DESC LIMIT 1", tuple(params))
        return r[coluna] if r else None

    def series(self, forno: str, horas: float = 24) -> dict:
        """Dados dos gráficos: leituras agregadas, amostras, setpoint, sugestões e modo."""
        nome = normalizar_forno(forno, self.fornos)
        if nome is None:
            raise ValueError(f"Forno desconhecido: {forno!r}")
        horas = min(max(float(horas), 1.0), 24 * 90)
        agora = self.relogio()
        inicio = agora - timedelta(hours=horas)
        passo_min = 1 if horas <= 6 else 5 if horas <= 48 else 15 if horas <= 24 * 8 else 60
        passo_s = passo_min * 60
        ms = lambda texto: int(de_iso(texto).timestamp() * 1000)  # noqa: E731

        leituras = self.banco.consultar(
            """SELECT CAST(strftime('%s', lido_em) AS INTEGER) / ? AS bloco,
                      AVG(CASE WHEN rodando = 1 THEN velocidade_hz END) AS velocidade_hz,
                      AVG(pressao_bar) AS pressao_bar, AVG(tsat_c) AS tsat_c,
                      AVG(temp_saida_c) AS temp_saida_c, MAX(rodando) AS rodando
               FROM leituras WHERE forno = ? AND lido_em >= ? GROUP BY bloco ORDER BY bloco""",
            (passo_s, nome, iso(inicio)),
        )
        serie_leituras = [{
            "t": (r["bloco"] * passo_s + passo_s // 2) * 1000,
            "velocidade_hz": _arred(r["velocidade_hz"], 2), "pressao_bar": _arred(r["pressao_bar"], 2),
            "tsat_c": _arred(r["tsat_c"], 1), "temp_saida_c": _arred(r["temp_saida_c"], 1),
            "rodando": bool(r["rodando"]),
        } for r in leituras]

        amostras = [{
            "t": ms(r["coletada_em"]), "umidade": r["umidade"], "umidade_alvo": r["umidade_alvo"],
            "responsavel": r["responsavel"], "tipo_farinha": r["tipo_farinha"], "origem": r["origem"],
        } for r in self.banco.consultar(
            """SELECT coletada_em, umidade, umidade_alvo, responsavel, tipo_farinha, origem FROM amostras
               WHERE forno = ? AND coletada_em >= ? ORDER BY coletada_em""", (nome, iso(inicio)))]

        sugestoes = [{
            "t": ms(r["calculada_em"]), "velocidade_sugerida_hz": _arred(r["velocidade_sugerida_hz"], 2),
            "acao": r["acao"], "origem": r["origem"], "aplicada": r["aplicada"], "modo": r["modo"],
        } for r in self.banco.consultar(
            """SELECT calculada_em, velocidade_sugerida_hz, acao, origem, aplicada, modo FROM sugestoes
               WHERE forno = ? AND calculada_em >= ? AND velocidade_sugerida_hz IS NOT NULL
               ORDER BY calculada_em LIMIT 20000""", (nome, iso(inicio)))]

        alvo_inicio = self._valor_em("setpoints", "umidade_alvo", inicio, nome) or self.fornos[nome].umidade_alvo
        setpoints = [{"t": int(inicio.timestamp() * 1000), "umidade_alvo": alvo_inicio, "alterado_por": None}]
        setpoints += [{"t": ms(r["alterado_em"]), "umidade_alvo": r["umidade_alvo"], "alterado_por": r["alterado_por"]}
                      for r in self.banco.consultar(
                          "SELECT * FROM setpoints WHERE forno = ? AND alterado_em > ? ORDER BY alterado_em, id",
                          (nome, iso(inicio)))]

        modo_inicio = self._valor_em("modos", "modo", inicio) or "linha_base"
        modos = [{"t": int(inicio.timestamp() * 1000), "modo": modo_inicio}]
        modos += [{"t": ms(r["alterado_em"]), "modo": r["modo"]} for r in self.banco.consultar(
            "SELECT * FROM modos WHERE alterado_em > ? ORDER BY alterado_em, id", (iso(inicio),))]

        return {
            "forno": nome, "inicio": int(inicio.timestamp() * 1000), "fim": int(agora.timestamp() * 1000),
            "passo_min": passo_min, "faixa_qualidade": self.fornos[nome].faixa_qualidade,
            "leituras": serie_leituras, "amostras": amostras, "sugestoes": sugestoes,
            "setpoints": setpoints, "modos": modos,
            "resumo": self.resumo_umidade(nome, inicio, agora),
        }

    def resumo_umidade(self, forno: str, inicio: datetime, fim: datetime) -> dict:
        """Indicadores de qualidade da umidade no período (geral e por modo de operação)."""
        p = self.fornos[forno]
        linhas = self.banco.consultar(
            """SELECT umidade, umidade_alvo, modo FROM amostras
               WHERE forno = ? AND coletada_em >= ? AND coletada_em <= ? AND umidade BETWEEN ? AND ?""",
            (forno, iso(inicio), iso(fim), p.umidade_min_valida, p.umidade_max_valida),
        )

        def calcular(rs: list[dict]) -> dict:
            n = len(rs)
            if n == 0:
                return {"n": 0, "media": None, "desvio": None, "erro_medio_abs": None, "dentro_faixa_pct": None}
            us = [r["umidade"] for r in rs]
            erros = [r["umidade"] - (r["umidade_alvo"] if r["umidade_alvo"] is not None else p.umidade_alvo)
                     for r in rs]
            media = sum(us) / n
            desvio = math.sqrt(sum((u - media) ** 2 for u in us) / (n - 1)) if n > 1 else None
            dentro = sum(1 for e in erros if abs(e) <= p.faixa_qualidade + 1e-9)
            return {"n": n, "media": round(media, 2), "desvio": None if desvio is None else round(desvio, 2),
                    "erro_medio_abs": round(sum(abs(e) for e in erros) / n, 2),
                    "dentro_faixa_pct": round(100 * dentro / n, 1)}

        por_modo = {m: calcular([r for r in linhas if (r["modo"] or "linha_base") == m]) for m in MODOS}
        return {"geral": calcular(linhas), "por_modo": por_modo, "faixa_qualidade": p.faixa_qualidade}


def _arred(v: float | None, casas: int) -> float | None:
    return None if v is None else round(v, casas)


def _sug_de_linha(linha: dict | None) -> dict | None:
    if linha is None:
        return None
    import json
    d = dict(linha)
    d["avisos"] = json.loads(d["avisos"] or "[]")
    return d
