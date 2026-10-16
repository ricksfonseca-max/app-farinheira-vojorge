"""Modelo de sugestão para o forno rotativo (rosca dosadora ou rotação do forno).

Ideia física:
  * Taxa de secagem ~ (T_vapor - T_massa)            (vapor mais frio = seca menos).
  * Tempo de residência ~ 1 / rotação do forno        (girar mais rápido = sai mais úmida).
  * Água a evaporar ~ alimentação (rosca dosadora)    (mais massa entrando = sai mais úmida).

A variável manipulada (VM) é configurável por forno:
  * "rotacao":     VM = rotação do forno;  fator = fator_vapor
  * "alimentacao": VM = rosca dosadora;    fator = fator_vapor × (rotacao_ref / rotação)
    (girar o forno mais rápido reduz a secagem por kg; o fator compensa isso também)

Carga "base" = VM / fator: o valor equivalente da VM nas condições de referência.

Duas partes:
  1. FEEDFORWARD (vapor e rotação): VM sugerida = base × fator atual.
     Se o vapor esfria (ou o forno passa a girar mais rápido), o fator cai e a
     sugestão reduz a VM na hora, sem esperar amostra.
  2. FEEDBACK (amostra de umidade a cada ~20 min): parte da base que a massa
     daquela amostra realmente viu no forno (média da janela de residência)
     e corrige com banda morta, fração alfa e passo máximo.

Tudo aqui é puro (sem banco, sem rede) para poder ser testado.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .config import ParametrosForno
from .vapor import tsat_pressao_manometrica

# Ações possíveis (o app usa estes códigos para cores/ícones)
MANTER = "manter"
AUMENTAR = "aumentar"
REDUZIR = "reduzir"
SEM_DADOS = "sem_dados"
FORNO_PARADO = "forno_parado"
SEM_VAPOR = "sem_vapor"
AMOSTRA_INVALIDA = "amostra_invalida"
AMOSTRA_ANTIGA = "amostra_antiga"

MARGEM_MIN_VAPOR_C = 10.0


@dataclass(frozen=True)
class LeituraProcesso:
    velocidade_hz: float | None          # rotação do forno
    pressao_bar: float | None
    rodando: bool
    lido_em: datetime | None
    temp_saida_c: float | None = None    # PT100 na saída do produto (futuro)
    alimentacao_hz: float | None = None  # rosca dosadora


@dataclass(frozen=True)
class EstadoControle:
    """Memória do controle para um forno (persistida no banco)."""

    base_alvo_hz: float | None = None      # rotação base desejada (com vapor de referência)
    fator_ref: float | None = None         # fator de vapor quando a base foi definida
    definido_em: datetime | None = None
    ultima_amostra_em: datetime | None = None
    ultima_mudanca_velocidade_em: datetime | None = None


@dataclass
class Sugestao:
    forno: str
    calculada_em: datetime
    origem: str                              # "amostra", "vapor" ou "setpoint"
    acao: str
    motivo: str
    variavel: str = "rotacao"                # qual VM os campos *_hz abaixo descrevem
    velocidade_atual_hz: float | None = None    # valor atual da VM
    velocidade_sugerida_hz: float | None = None  # valor sugerido da VM
    pressao_bar: float | None = None
    tsat_c: float | None = None
    fator_vapor: float | None = None
    umidade: float | None = None
    umidade_alvo: float | None = None
    erro: float | None = None
    delta_hz: float | None = None
    delta_amostra_hz: float | None = None    # parte da correção vinda da umidade
    delta_vapor_hz: float | None = None      # parte da correção vinda do vapor
    ganho_k: float | None = None
    avisos: list[str] = field(default_factory=list)

    def como_dict(self) -> dict:
        d = dict(self.__dict__)
        d["calculada_em"] = self.calculada_em.isoformat()
        for k in ("velocidade_atual_hz", "velocidade_sugerida_hz", "pressao_bar", "tsat_c",
                  "fator_vapor", "erro", "delta_hz", "delta_amostra_hz", "delta_vapor_hz"):
            if d[k] is not None:
                d[k] = round(d[k], 3)
        return d


def fator_vapor(tsat_c: float | None, p: ParametrosForno) -> float | None:
    """Capacidade relativa de secagem do vapor. None = vapor insuficiente."""
    if tsat_c is None or tsat_c - p.t_produto_c < MARGEM_MIN_VAPOR_C:
        return None
    return (tsat_c - p.t_produto_c) / (p.tsat_ref_c - p.t_produto_c)


NOME_VM = {"alimentacao": "Rosca", "rotacao": "Rotação"}


def valor_manipulada(p: ParametrosForno, leitura) -> float | None:
    """Valor atual da variável manipulada (aceita LeituraProcesso ou linha do banco)."""
    campo = "alimentacao_hz" if p.manipulada == "alimentacao" else "velocidade_hz"
    return leitura[campo] if isinstance(leitura, dict) else getattr(leitura, campo)


def fator_processo(p: ParametrosForno, tsat_c: float | None, rotacao_hz: float | None) -> float | None:
    """Capacidade relativa de secagem por unidade da variável manipulada."""
    fv = fator_vapor(tsat_c, p)
    if fv is None:
        return None
    if p.manipulada == "alimentacao":
        if rotacao_hz is None or rotacao_hz < 1.0:
            return None
        return fv * p.rotacao_ref_hz / rotacao_hz
    return fv


def _n(v: float, casas: int = 1, sinal: bool = False) -> str:
    """Número no formato brasileiro (vírgula decimal)."""
    return f"{v:{'+' if sinal else ''}.{casas}f}".replace(".", ",")


def _limitar(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _acao_por_delta(delta: float, limiar: float) -> str:
    if delta <= -limiar:
        return REDUZIR
    if delta >= limiar:
        return AUMENTAR
    return MANTER


def _checar_processo(
    p: ParametrosForno, leitura: LeituraProcesso | None, agora: datetime, validade_s: float
) -> tuple[str, str] | None:
    """Retorna (ação, motivo) se o processo não permite sugerir, senão None."""
    if leitura is None or leitura.lido_em is None:
        return SEM_DADOS, "Sem leitura de rotação/vapor do CLP."
    idade = (agora - leitura.lido_em).total_seconds()
    if idade > validade_s:
        return SEM_DADOS, f"Leitura do CLP desatualizada ({_n(idade / 60, 0)} min)."
    mv = valor_manipulada(p, leitura)
    if leitura.velocidade_hz is None or leitura.pressao_bar is None or mv is None:
        falta = "rosca" if mv is None and p.manipulada == "alimentacao" else "rotação ou pressão"
        return SEM_DADOS, f"Leitura do CLP incompleta ({falta} ausente)."
    if not leitura.rodando or leitura.velocidade_hz < 1.0:
        return FORNO_PARADO, "Forno parado."
    if mv < 1.0:
        return FORNO_PARADO, "Rosca dosadora parada."
    tsat = tsat_pressao_manometrica(leitura.pressao_bar)
    if fator_vapor(tsat, p) is None:
        return SEM_VAPOR, f"Pressão de vapor insuficiente ({_n(leitura.pressao_bar, 1)} bar)."
    return None


def sugerir_por_amostra(
    p: ParametrosForno,
    leitura: LeituraProcesso | None,
    estado: EstadoControle,
    umidade: float,
    coletada_em: datetime,
    agora: datetime,
    ganho_k: float,
    leitura_validade_s: float = 120.0,
    base_janela_hz: float | None = None,
    aviso_janela: str | None = None,
) -> tuple[Sugestao, EstadoControle]:
    """Nova amostra de umidade -> sugestão de rotação e novo estado do controle.

    base_janela_hz: rotação base média (rotação / fator_vapor) enquanto a massa desta
    amostra estava dentro do forno. A correção parte DELA, e não da rotação atual:
      * não corrige duas vezes (se a amostra ainda reflete a rotação antiga, a
        base da janela também é a antiga, e o alvo calculado é o mesmo);
      * não "esquece" uma compensação de vapor que ainda não foi aplicada;
      * se o operador não aplicar a sugestão, a próxima amostra repete a mesma
        sugestão em vez de acumular correções.
    """
    sug = Sugestao(
        forno=p.nome, calculada_em=agora, origem="amostra", acao=MANTER, motivo="",
        umidade=umidade, umidade_alvo=p.umidade_alvo, ganho_k=ganho_k, variavel=p.manipulada,
    )
    sug.erro = umidade - p.umidade_alvo

    if not (p.umidade_min_valida <= umidade <= p.umidade_max_valida):
        sug.acao = AMOSTRA_INVALIDA
        sug.motivo = (f"Umidade {_n(umidade, 1)}% fora da faixa válida "
                      f"({_n(p.umidade_min_valida, 0)}–{_n(p.umidade_max_valida, 0)}%). Confira a medição.")
        return sug, estado

    idade_min = (agora - coletada_em).total_seconds() / 60
    if idade_min > p.validade_amostra_min:
        sug.acao = AMOSTRA_ANTIGA
        sug.motivo = f"Amostra de {_n(idade_min, 0)} min atrás: guardada, mas não usada para corrigir."
        return sug, estado

    bloqueio = _checar_processo(p, leitura, agora, leitura_validade_s)
    if bloqueio:
        sug.acao, sug.motivo = bloqueio
        return sug, EstadoControle(
            base_alvo_hz=estado.base_alvo_hz, fator_ref=estado.fator_ref,
            definido_em=estado.definido_em, ultima_amostra_em=coletada_em,
            ultima_mudanca_velocidade_em=estado.ultima_mudanca_velocidade_em,
        )

    assert leitura is not None and leitura.velocidade_hz is not None
    f_atual = valor_manipulada(p, leitura)
    tsat = tsat_pressao_manometrica(leitura.pressao_bar)
    fator = fator_processo(p, tsat, leitura.velocidade_hz)
    assert f_atual is not None and tsat is not None and fator is not None
    sug.variavel = p.manipulada
    sug.velocidade_atual_hz = f_atual
    sug.pressao_bar = leitura.pressao_bar
    sug.tsat_c = tsat
    sug.fator_vapor = fator

    base_atual = f_atual / fator
    if base_janela_hz is None or base_janela_hz <= 0:
        base_janela_hz = base_atual
        sug.avisos.append("Sem histórico de rotação da janela: usando a rotação atual como referência.")
    elif aviso_janela:
        sug.avisos.append(aviso_janela)

    erro = sug.erro
    if abs(erro) <= p.banda_morta:
        delta_base = 0.0
    else:
        delta_base = _limitar(-p.alfa * erro / ganho_k, -p.passo_max_hz, p.passo_max_hz)

    base_desejada = base_janela_hz + delta_base
    f_sug = _limitar(base_desejada * fator, p.f_min_hz, p.f_max_hz)
    f_sem_correcao = _limitar(base_janela_hz * fator, p.f_min_hz, p.f_max_hz)
    delta = f_sug - f_atual
    sug.velocidade_sugerida_hz = f_sug
    sug.delta_hz = delta
    sug.delta_amostra_hz = f_sug - f_sem_correcao
    sug.delta_vapor_hz = f_sem_correcao - f_atual
    sug.acao = _acao_por_delta(delta, p.limiar_mudanca_hz / 2)

    if abs(erro) <= p.banda_morta:
        sug.motivo = (f"Umidade {_n(umidade, 1)}% dentro da faixa "
                      f"({_n(p.umidade_alvo, 1)} ± {_n(p.banda_morta, 1)}%).")
    else:
        sentido = "acima" if erro > 0 else "abaixo"
        sug.motivo = f"Umidade {_n(umidade, 1)}% está {_n(abs(erro), 1)} ponto(s) {sentido} do alvo {_n(p.umidade_alvo, 1)}%."
        if abs(-p.alfa * erro / ganho_k) > p.passo_max_hz:
            sug.avisos.append(f"Correção limitada a {_n(p.passo_max_hz, 1)} Hz por amostra.")
    if abs(sug.delta_vapor_hz) >= p.limiar_mudanca_hz:
        sug.motivo += f" Compensação de vapor/rotação desde a amostra: {_n(sug.delta_vapor_hz, 1, True)} Hz."
    if sug.acao == MANTER:
        sug.motivo += f" Manter {NOME_VM[p.manipulada].lower()}."
    else:
        sug.motivo += f" {NOME_VM[p.manipulada]} {_n(f_atual, 1)} → {_n(f_sug, 1)} Hz."
    if f_sug in (p.f_min_hz, p.f_max_hz) and abs(delta) > 0:
        sug.avisos.append(f"Sugestão limitada pela faixa {_n(p.f_min_hz, 0)}–{_n(p.f_max_hz, 0)} Hz.")

    novo = EstadoControle(
        base_alvo_hz=f_sug / fator, fator_ref=fator, definido_em=agora,
        ultima_amostra_em=coletada_em,
        ultima_mudanca_velocidade_em=estado.ultima_mudanca_velocidade_em,
    )
    return sug, novo


def sugerir_por_vapor(
    p: ParametrosForno,
    leitura: LeituraProcesso | None,
    estado: EstadoControle,
    agora: datetime,
    leitura_validade_s: float = 120.0,
    ultima_umidade: float | None = None,
) -> Sugestao:
    """Sugestão "ao vivo": aplica o fator de vapor atual à rotação base desejada."""
    sug = Sugestao(forno=p.nome, calculada_em=agora, origem="vapor", acao=MANTER, motivo="",
                   umidade=ultima_umidade, umidade_alvo=p.umidade_alvo, variavel=p.manipulada)
    if ultima_umidade is not None:
        sug.erro = ultima_umidade - p.umidade_alvo

    bloqueio = _checar_processo(p, leitura, agora, leitura_validade_s)
    if bloqueio:
        sug.acao, sug.motivo = bloqueio
        return sug

    assert leitura is not None and leitura.velocidade_hz is not None
    f_atual = valor_manipulada(p, leitura)
    tsat = tsat_pressao_manometrica(leitura.pressao_bar)
    fator = fator_processo(p, tsat, leitura.velocidade_hz)
    assert f_atual is not None and tsat is not None and fator is not None
    sug.variavel = p.manipulada
    sug.velocidade_atual_hz = f_atual
    sug.pressao_bar = leitura.pressao_bar
    sug.tsat_c = tsat
    sug.fator_vapor = fator

    if estado.ultima_amostra_em is None:
        sug.avisos.append("Nenhuma amostra de umidade ainda. Registre a primeira no app.")
    else:
        idade = (agora - estado.ultima_amostra_em).total_seconds() / 60
        if idade > p.validade_amostra_min:
            sug.avisos.append(f"Última amostra há {_n(idade, 0)} min. Colete uma nova amostra.")

    if estado.base_alvo_hz is None:
        sug.velocidade_sugerida_hz = f_atual
        sug.delta_hz = 0.0
        sug.motivo = f"Sem referência de umidade ainda: manter {NOME_VM[p.manipulada].lower()} atual."
        return sug

    f_sug = _limitar(estado.base_alvo_hz * fator, p.f_min_hz, p.f_max_hz)
    fator_ref = estado.fator_ref or fator
    f_ref = _limitar(estado.base_alvo_hz * fator_ref, p.f_min_hz, p.f_max_hz)
    delta = f_sug - f_atual
    sug.velocidade_sugerida_hz = f_sug
    sug.delta_hz = delta
    sug.delta_vapor_hz = f_sug - f_ref
    sug.delta_amostra_hz = f_ref - f_atual
    sug.acao = _acao_por_delta(delta, p.limiar_mudanca_hz)

    if sug.acao == MANTER:
        sug.motivo = f"{NOME_VM[p.manipulada]} {_n(f_atual, 1)} Hz adequada para o vapor atual ({_n(tsat, 0)} °C)."
    else:
        partes = []
        if abs(sug.delta_amostra_hz) >= p.limiar_mudanca_hz:
            partes.append(f"correção da última amostra ({_n(sug.delta_amostra_hz, 1, True)} Hz)")
        if abs(sug.delta_vapor_hz) >= p.limiar_mudanca_hz:
            if p.manipulada == "alimentacao":
                partes.append(f"vapor ({_n(tsat, 0)} °C) e rotação do forno ({_n(sug.delta_vapor_hz, 1, True)} Hz)")
            else:
                sentido = "caiu" if sug.delta_vapor_hz < 0 else "subiu"
                partes.append(f"vapor {sentido} para {_n(tsat, 0)} °C ({_n(sug.delta_vapor_hz, 1, True)} Hz)")
        detalhe = " e ".join(partes) if partes else "ajuste acumulado"
        sug.motivo = f"{NOME_VM[p.manipulada]} {_n(f_atual, 1)} → {_n(f_sug, 1)} Hz: {detalhe}."
    return sug
