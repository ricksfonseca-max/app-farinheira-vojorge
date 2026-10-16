"""Variável manipulada = rosca dosadora (alimentação), com a rotação do forno como perturbação medida."""

import unittest
from collections import deque
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from app import modelo
from app.banco import Banco
from app.coletor import interpretar_fornos
from app.config import ConfigServico, ParametrosForno
from app.modelo import EstadoControle, LeituraProcesso, fator_processo, fator_vapor
from app.servico import ServicoUmidade
from app.vapor import tsat_pressao_manometrica

T0 = datetime(2026, 10, 16, 6, 0, tzinfo=timezone.utc)
P = ParametrosForno(nome="Forno 01", manipulada="alimentacao", rotacao_ref_hz=40.0,
                    t_residencia_min=20.0, f_min_hz=10.0, f_max_hz=60.0)
PASSO_S = 15


def leitura(rosca=30.0, rot=40.0, p_bar=8.0, quando=T0, rodando=True):
    return LeituraProcesso(rot, p_bar, rodando, quando, None, rosca)


class TestModeloRosca(unittest.TestCase):
    def test_umidade_alta_reduz_a_rosca(self):
        sug, est = modelo.sugerir_por_amostra(P, leitura(), EstadoControle(), 13.5, T0, T0, 0.5)
        self.assertEqual(sug.variavel, "alimentacao")
        self.assertEqual(sug.acao, modelo.REDUZIR)
        self.assertLess(sug.velocidade_sugerida_hz, 30.0)
        self.assertTrue(sug.motivo.endswith("Hz."))
        self.assertIn("Rosca 30,0 →", sug.motivo)

    def test_forno_mais_rapido_pede_menos_rosca(self):
        _, est = modelo.sugerir_por_amostra(P, leitura(rot=40.0), EstadoControle(), 12.0, T0, T0, 0.5)
        t1 = T0 + timedelta(minutes=3)
        sug = modelo.sugerir_por_vapor(P, leitura(rot=44.0, quando=t1), est, t1)
        # menos tempo dentro do forno -> menos massa para a mesma umidade: 30 × 40/44
        self.assertEqual(sug.acao, modelo.REDUZIR)
        self.assertAlmostEqual(sug.velocidade_sugerida_hz, 30.0 * 40 / 44, places=3)
        self.assertIn("rotação do forno", sug.motivo)

    def test_sem_leitura_da_rosca(self):
        sug, _ = modelo.sugerir_por_amostra(P, leitura(rosca=None), EstadoControle(), 13.0, T0, T0, 0.5)
        self.assertEqual(sug.acao, modelo.SEM_DADOS)
        self.assertIn("rosca", sug.motivo)

    def test_rosca_parada(self):
        sug, _ = modelo.sugerir_por_amostra(P, leitura(rosca=0.0), EstadoControle(), 13.0, T0, T0, 0.5)
        self.assertEqual(sug.acao, modelo.FORNO_PARADO)
        self.assertIn("Rosca", sug.motivo)

    def test_fator_processo(self):
        tsat = tsat_pressao_manometrica(8.0)
        self.assertAlmostEqual(fator_processo(P, tsat, 40.0), fator_vapor(tsat, P))
        self.assertAlmostEqual(fator_processo(P, tsat, 20.0), 2 * fator_vapor(tsat, P))
        self.assertIsNone(fator_processo(P, tsat, 0.0))
        self.assertAlmostEqual(fator_processo(replace(P, manipulada="rotacao"), tsat, 20.0), fator_vapor(tsat, P))


class FornoComRosca:
    """Umidade = a + K × média(rosca × rotação / ref / fator_vapor) na residência + perturbação."""

    def __init__(self, p, k=0.4, rosca=30.0, rot=40.0, pressao=8.0):
        self.p, self.k, self.rosca, self.rot, self.pressao, self.pert = p, k, rosca, rot, pressao, 0.0
        base0 = rosca * rot / p.rotacao_ref_hz / fator_vapor(tsat_pressao_manometrica(pressao), p)
        self.a = p.umidade_alvo - k * base0
        n = int(p.t_residencia_min * 60 / PASSO_S)
        self.jan = deque([base0] * n, maxlen=n)
        self.sai = deque(maxlen=int(p.t_coleta_min * 60 / PASSO_S) + 1)

    def passo(self):
        fv = fator_vapor(tsat_pressao_manometrica(self.pressao), self.p)
        self.jan.append(self.rosca * self.rot / self.p.rotacao_ref_hz / fv)
        self.sai.append(self.a + self.k * sum(self.jan) / len(self.jan) + self.pert)


class TestSimulacaoRosca(unittest.TestCase):
    def rodar(self, eventos, horas=6, seguir=True):
        relogio = type("R", (), {"t": T0, "__call__": lambda self: self.t})()
        s = ServicoUmidade(ConfigServico(intervalo_leitura_s=PASSO_S, modo_inicial="conselheiro"),
                           {"Forno 01": P}, Banco(":memory:"), relogio)
        f = FornoComRosca(P)
        hist = []
        for i in range(int(horas * 3600 / PASSO_S)):
            relogio.t = T0 + timedelta(seconds=i * PASSO_S)
            for h, acao in eventos:
                if i == int(h * 3600 / PASSO_S):
                    acao(f)
            f.passo()
            s.registrar_leitura("Forno 01", f.rot, f.pressao, True, relogio.t, alimentacao_hz=f.rosca)
            if i % int(20 * 60 / PASSO_S) == 0 and i > 0:
                u = round(f.sai[0], 1)
                r = s.processar_amostra("Forno 01", u, relogio.t)
                hist.append((relogio.t, u))
                if seguir and r["sugestao"]["acao"] in (modelo.AUMENTAR, modelo.REDUZIR):
                    f.rosca = r["sugestao"]["velocidade_sugerida_hz"]
            elif seguir and i % 4 == 0:
                sug = s.sugestao_atual("Forno 01")
                if sug.acao in (modelo.AUMENTAR, modelo.REDUZIR):
                    f.rosca = sug.velocidade_sugerida_hz
        return s, hist

    def test_rejeita_massa_mais_umida(self):
        def mais_umida(f):
            f.pert = 1.2

        _, hist = self.rodar([(1.0, mais_umida)])
        finais = [u for t, u in hist if t > T0 + timedelta(hours=4)]
        self.assertTrue(all(abs(u - 12.0) <= 0.5 for u in finais), hist)

    def test_operador_acelera_o_forno(self):
        def acelera(f):
            f.rot = 46.0

        _, com = self.rodar([(1.5, acelera)])
        _, sem = self.rodar([(1.5, acelera)], seguir=False)
        desvio_com = max(abs(u - 12.0) for t, u in com if t > T0 + timedelta(hours=1.5))
        desvio_sem = max(abs(u - 12.0) for t, u in sem if t > T0 + timedelta(hours=1.5))
        self.assertGreater(desvio_sem, 1.0)
        self.assertLess(desvio_com, 0.3)

    def test_aplicacao_avaliada_pela_rosca(self):
        def mais_umida(f):
            f.pert = 1.2

        s, _ = self.rodar([(1.0, mais_umida)])
        s.verificar_aplicacao()
        aval = s.banco.consultar(
            "SELECT aplicada, variavel FROM sugestoes WHERE acao IN ('aumentar','reduzir') AND aplicada IS NOT NULL")
        self.assertTrue(aval)
        self.assertTrue(all(a["variavel"] == "alimentacao" and a["aplicada"] == 1 for a in aval), aval)
        serie = s.series("Forno 01", horas=6)
        self.assertEqual(serie["variavel"], "alimentacao")
        self.assertIsNotNone(serie["leituras"][-1]["alimentacao_hz"])


class TestColetor(unittest.TestCase):
    def test_le_a_rosca(self):
        f = interpretar_fornos({"fornos": [{"forno": "Forno 01", "velocidade_hz": 40, "pressao_vapor_bar": 7.8,
                                            "rosca_hz": 31.5, "rodando": True}]})
        self.assertEqual(f[0]["alimentacao_hz"], 31.5)


if __name__ == "__main__":
    unittest.main()
