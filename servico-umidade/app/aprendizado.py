"""Estimativa do ganho K (% de umidade por Hz) a partir do histórico.

Usa as amostras em que a rotação ficou estável durante a passagem da massa pelo
forno. Para cada uma, a rotação é "normalizada" pelo vapor (rotação base), e
ajusta-se uma reta umidade = a + K × rotação_base.

Para a reta ser confiável é preciso que a rotação tenha variado durante o mês.
Se o forno roda sempre na mesma rotação, não há como medir o efeito dela.
"""

from __future__ import annotations

from dataclasses import dataclass

N_MIN = 15
FAIXA_MIN_HZ = 2.0
R2_MIN = 0.3
K_MIN, K_MAX = 0.05, 3.0


@dataclass(frozen=True)
class EstimativaK:
    k: float | None
    intercepto: float | None
    r2: float | None
    n: int
    faixa_hz: float
    confiavel: bool
    motivo: str

    def como_dict(self) -> dict:
        return {
            "k": None if self.k is None else round(self.k, 4),
            "intercepto": None if self.intercepto is None else round(self.intercepto, 3),
            "r2": None if self.r2 is None else round(self.r2, 3),
            "n": self.n,
            "faixa_hz": round(self.faixa_hz, 2),
            "confiavel": self.confiavel,
            "motivo": self.motivo,
        }


def estimar_k(pontos: list[tuple[float, float]]) -> EstimativaK:
    """pontos = [(rotacao_base_hz, umidade_%), ...]"""
    n = len(pontos)
    if n < 3:
        return EstimativaK(None, None, None, n, 0.0, False,
                           f"Poucas amostras válidas ({n}). São necessárias pelo menos {N_MIN}.")
    xs = [x for x, _ in pontos]
    ys = [y for _, y in pontos]
    faixa = max(xs) - min(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in pontos)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 1e-9:
        return EstimativaK(None, None, None, n, faixa, False,
                           "A rotação não variou: impossível medir o efeito dela na umidade.")
    k = sxy / sxx
    a = my - k * mx
    r2 = (sxy * sxy) / (sxx * syy) if syy > 1e-12 else 0.0

    problemas = []
    if n < N_MIN:
        problemas.append(f"poucas amostras ({n} de {N_MIN})")
    if faixa < FAIXA_MIN_HZ:
        problemas.append(f"rotação variou só {faixa:.1f} Hz (mínimo {FAIXA_MIN_HZ:.0f})")
    if r2 < R2_MIN:
        problemas.append(f"correlação fraca (R² {r2:.2f})")
    if not (K_MIN <= k <= K_MAX):
        problemas.append(f"K fora da faixa plausível ({k:.2f})")

    if problemas:
        return EstimativaK(k, a, r2, n, faixa, False, "Ainda não confiável: " + "; ".join(problemas) + ".")
    return EstimativaK(k, a, r2, n, faixa, True,
                       f"K = {k:.2f} %/Hz estimado com {n} amostras (R² {r2:.2f}).")
