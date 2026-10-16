"""Tabela de vapor saturado: pressão -> temperatura de saturação.

O manômetro da caldeira/forno mostra pressão RELATIVA (manométrica).
A tabela de vapor usa pressão ABSOLUTA, por isso somamos a pressão atmosférica.
"""

from __future__ import annotations

P_ATM_BAR = 1.01325

# (pressão absoluta em bar, temperatura de saturação em °C) — tabela IAPWS-IF97
_TABELA_SATURACAO: tuple[tuple[float, float], ...] = (
    (1.0, 99.61),
    (1.5, 111.35),
    (2.0, 120.21),
    (3.0, 133.52),
    (4.0, 143.61),
    (5.0, 151.83),
    (6.0, 158.83),
    (7.0, 164.95),
    (8.0, 170.41),
    (9.0, 175.36),
    (10.0, 179.88),
    (11.0, 184.06),
    (12.0, 187.96),
    (13.0, 191.60),
    (14.0, 195.04),
    (15.0, 198.29),
    (16.0, 201.37),
    (17.0, 204.31),
    (18.0, 207.11),
    (20.0, 212.38),
)


def tsat_pressao_absoluta(p_abs_bar: float | None) -> float | None:
    """Temperatura de saturação (°C) para uma pressão absoluta (bar).

    Retorna None fora da faixa da tabela (sem vapor ou leitura inválida).
    """
    if p_abs_bar is None:
        return None
    tabela = _TABELA_SATURACAO
    if p_abs_bar < tabela[0][0] or p_abs_bar > tabela[-1][0]:
        return None
    for (p1, t1), (p2, t2) in zip(tabela, tabela[1:]):
        if p1 <= p_abs_bar <= p2:
            return t1 + (t2 - t1) * (p_abs_bar - p1) / (p2 - p1)
    return None  # inalcançável


def tsat_pressao_manometrica(p_man_bar: float | None) -> float | None:
    """Temperatura de saturação (°C) para a pressão do manômetro (bar relativo)."""
    if p_man_bar is None:
        return None
    return tsat_pressao_absoluta(p_man_bar + P_ATM_BAR)
