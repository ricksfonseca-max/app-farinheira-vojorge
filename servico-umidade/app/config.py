"""Configuração do serviço (variáveis de ambiente) e parâmetros de cada forno (JSON)."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field, fields, replace
from datetime import timedelta, timezone


@dataclass(frozen=True)
class ParametrosForno:
    """Parâmetros do modelo para um forno. Todos podem ser ajustados no fornos.json."""

    nome: str
    umidade_alvo: float = 12.0          # % de umidade desejada na saída
    f_min_hz: float = 20.0              # rotação mínima permitida para sugestão
    f_max_hz: float = 60.0              # rotação máxima permitida para sugestão
    passo_max_hz: float = 2.0           # maior correção por amostra
    banda_morta: float = 0.3            # erro de umidade (%) abaixo do qual não se corrige
    ganho_k: float = 0.5                # % de umidade por Hz (mais rápido = mais úmido)
    alfa: float = 0.5                   # fração do erro corrigida por amostra (0..1)
    t_residencia_min: float = 30.0      # tempo da massa do início ao fim do forno
    t_coleta_min: float = 5.0           # tempo entre a saída do forno e a medição
    t_produto_c: float = 100.0          # temperatura da massa enquanto evapora água
    tsat_ref_c: float = 175.0           # temperatura de vapor de referência (≈ 8 bar man.)
    validade_amostra_min: float = 40.0  # sem amostra por mais que isso -> aviso
    umidade_min_valida: float = 2.0     # amostras fora desta faixa são rejeitadas
    umidade_max_valida: float = 30.0
    limiar_mudanca_hz: float = 0.5      # variação de rotação considerada "mudança"
    usar_k_aprendido: bool = False      # usa o K estimado pelos dados quando confiável
    intervalo_amostra_min: float = 20.0 # rotina de coleta do operador


_CAMPOS = {f.name for f in fields(ParametrosForno)} - {"nome"}


def carregar_fornos(caminho: str | None) -> dict[str, ParametrosForno]:
    """Lê o fornos.json. Estrutura: {"padrao": {...}, "fornos": {"Forno 01": {...}}}."""
    if caminho and os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as f:
            bruto = json.load(f)
    else:
        bruto = {"fornos": {"Forno 01": {}, "Forno 02": {}}}

    padrao = _filtrar(bruto.get("padrao", {}))
    fornos: dict[str, ParametrosForno] = {}
    for nome, ajustes in bruto.get("fornos", {}).items():
        params = replace(ParametrosForno(nome=nome), **padrao)
        params = replace(params, **_filtrar(ajustes or {}))
        _validar(params)
        fornos[nome] = params
    if not fornos:
        raise ValueError("fornos.json não define nenhum forno")
    return fornos


def _filtrar(d: dict) -> dict:
    desconhecidos = set(d) - _CAMPOS
    if desconhecidos:
        raise ValueError(f"Parâmetros desconhecidos no fornos.json: {sorted(desconhecidos)}")
    return dict(d)


def _validar(p: ParametrosForno) -> None:
    erros = []
    if not (0 < p.f_min_hz < p.f_max_hz):
        erros.append("f_min_hz deve ser > 0 e menor que f_max_hz")
    if p.ganho_k <= 0:
        erros.append("ganho_k deve ser positivo")
    if not (0 < p.alfa <= 1):
        erros.append("alfa deve estar entre 0 e 1")
    if p.tsat_ref_c - p.t_produto_c < 10:
        erros.append("tsat_ref_c deve ser pelo menos 10 °C maior que t_produto_c")
    if not (p.umidade_min_valida < p.umidade_alvo < p.umidade_max_valida):
        erros.append("umidade_alvo deve estar dentro da faixa válida")
    if erros:
        raise ValueError(f"{p.nome}: " + "; ".join(erros))


def normalizar_forno(nome: str | None, fornos: dict[str, ParametrosForno]) -> str | None:
    """Associa 'Forno 01', 'forno 1', 'F1'... ao nome configurado."""
    if not nome:
        return None
    nome = str(nome).strip()
    for chave in fornos:
        if chave.lower() == nome.lower():
            return chave
    digitos = re.sub(r"\D", "", nome).lstrip("0")
    if digitos:
        for chave in fornos:
            if re.sub(r"\D", "", chave).lstrip("0") == digitos:
                return chave
    return None


def _fuso(texto: str) -> timezone:
    m = re.fullmatch(r"([+-])(\d{2}):?(\d{2})", texto.strip())
    if not m:
        raise ValueError(f"FUSO_HORARIO_PADRAO inválido: {texto!r} (use -03:00)")
    sinal = -1 if m.group(1) == "-" else 1
    return timezone(sinal * timedelta(hours=int(m.group(2)), minutes=int(m.group(3))))


@dataclass(frozen=True)
class ConfigServico:
    porta: int = 8000
    banco: str = "/dados/umidade.db"
    fonte_processo_url: str = ""
    registros_url: str = ""
    intervalo_leitura_s: float = 15.0
    intervalo_sync_s: float = 300.0
    sync_janela_horas: float = 24.0
    timeout_http_s: float = 5.0
    leitura_validade_s: float = 120.0
    janela_aplicacao_min: float = 15.0
    token_api: str = ""
    cors_origem: str = "*"
    fuso_padrao: timezone = field(default_factory=lambda: _fuso("-03:00"))
    config_fornos: str = "/app/config/fornos.json"

    @classmethod
    def do_ambiente(cls) -> "ConfigServico":
        e = os.environ.get
        return cls(
            porta=int(e("PORTA", "8000")),
            banco=e("BANCO", "/dados/umidade.db"),
            fonte_processo_url=e("FONTE_PROCESSO_URL", ""),
            registros_url=e("REGISTROS_URL", ""),
            intervalo_leitura_s=float(e("INTERVALO_LEITURA_S", "15")),
            intervalo_sync_s=float(e("INTERVALO_SYNC_S", "300")),
            sync_janela_horas=float(e("SYNC_JANELA_HORAS", "24")),
            timeout_http_s=float(e("TIMEOUT_HTTP_S", "5")),
            leitura_validade_s=float(e("LEITURA_VALIDADE_S", "120")),
            janela_aplicacao_min=float(e("JANELA_APLICACAO_MIN", "15")),
            token_api=e("TOKEN_API", ""),
            cors_origem=e("CORS_ORIGEM", "*"),
            fuso_padrao=_fuso(e("FUSO_HORARIO_PADRAO", "-03:00")),
            config_fornos=e("CONFIG_FORNOS", "/app/config/fornos.json"),
        )
