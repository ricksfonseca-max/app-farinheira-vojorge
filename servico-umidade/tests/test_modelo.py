import unittest
from datetime import datetime, timedelta, timezone

from app import modelo
from app.aprendizado import estimar_k
from app.config import ParametrosForno, carregar_fornos, normalizar_forno
from app.modelo import EstadoControle, LeituraProcesso
from app.vapor import tsat_pressao_absoluta, tsat_pressao_manometrica

T0 = datetime(2026, 10, 16, 10, 0, tzinfo=timezone.utc)
P = ParametrosForno(nome="Forno 01")  # alvo 12%, K 0,5, alfa 0,5, passo 2 Hz


def leitura(v=40.0, p_bar=8.0, rodando=True, quando=T0):
    return LeituraProcesso(v, p_bar, rodando, quando)


class TestVapor(unittest.TestCase):
    def test_pontos_da_tabela(self):
        self.assertAlmostEqual(tsat_pressao_absoluta(10.0), 179.88, places=2)
        self.assertAlmostEqual(tsat_pressao_absoluta(1.0), 99.61, places=2)

    def test_manometrica_soma_atmosfera(self):
        # 8 bar no manômetro = 9,013 bar absoluto ≈ 175,4 °C
        self.assertAlmostEqual(tsat_pressao_manometrica(8.0), 175.4, delta=0.2)
        self.assertAlmostEqual(tsat_pressao_manometrica(7.0), 170.5, delta=0.2)

    def test_interpolacao_monotona(self):
        anterior = 0
        for i in range(0, 190):
            t = tsat_pressao_absoluta(1.0 + i * 0.1)
            self.assertGreater(t, anterior)
            anterior = t

    def test_fora_da_faixa(self):
        self.assertIsNone(tsat_pressao_absoluta(0.5))
        self.assertIsNone(tsat_pressao_absoluta(25))
        self.assertIsNone(tsat_pressao_manometrica(None))


class TestAmostra(unittest.TestCase):
    def sugerir(self, umidade, v=40.0, p_bar=8.0, estado=EstadoControle(), k=0.5, params=P):
        return modelo.sugerir_por_amostra(params, leitura(v, p_bar), estado, umidade, T0, T0, k)

    def test_umidade_alta_reduz_rotacao(self):
        sug, est = self.sugerir(13.5)
        # erro +1,5 -> -0,5*1,5/0,5 = -1,5 Hz (vapor perto da referência)
        self.assertEqual(sug.acao, modelo.REDUZIR)
        self.assertAlmostEqual(sug.delta_hz, -1.5 * sug.fator_vapor, places=3)
        self.assertLess(sug.velocidade_sugerida_hz, 40)
        self.assertIsNotNone(est.base_alvo_hz)

    def test_umidade_baixa_aumenta_rotacao(self):
        sug, _ = self.sugerir(10.8)
        self.assertEqual(sug.acao, modelo.AUMENTAR)
        self.assertGreater(sug.velocidade_sugerida_hz, 40)

    def test_banda_morta(self):
        sug, est = self.sugerir(12.2)
        self.assertEqual(sug.acao, modelo.MANTER)
        self.assertAlmostEqual(sug.velocidade_sugerida_hz, 40.0)
        self.assertAlmostEqual(est.base_alvo_hz * est.fator_ref, 40.0)

    def test_passo_maximo(self):
        sug, _ = self.sugerir(20.0)
        self.assertAlmostEqual(sug.delta_hz, -P.passo_max_hz * sug.fator_vapor, places=3)
        self.assertTrue(any("limitada" in a for a in sug.avisos))

    def test_faixa_de_rotacao(self):
        sug, _ = self.sugerir(15.0, v=21.0)
        self.assertEqual(sug.velocidade_sugerida_hz, P.f_min_hz)

    def test_amostra_invalida(self):
        sug, est = self.sugerir(45.0)
        self.assertEqual(sug.acao, modelo.AMOSTRA_INVALIDA)
        self.assertIsNone(est.base_alvo_hz)

    def test_amostra_antiga(self):
        sug, _ = modelo.sugerir_por_amostra(P, leitura(), EstadoControle(), 14.0,
                                            T0 - timedelta(minutes=60), T0, 0.5)
        self.assertEqual(sug.acao, modelo.AMOSTRA_ANTIGA)

    def test_corrige_a_partir_da_janela_e_nao_da_rotacao_atual(self):
        # A massa medida passou pelo forno a 40 Hz (base); o operador já baixou para 38.
        # Alvo = 40 - 1,5 = 38,5 (base): não pode descontar de novo a partir dos 38.
        fator = modelo.fator_vapor(tsat_pressao_manometrica(8.0), P)
        sug, est = modelo.sugerir_por_amostra(P, leitura(38.0), EstadoControle(), 13.5, T0, T0, 0.5,
                                              base_janela_hz=40.0)
        self.assertAlmostEqual(sug.velocidade_sugerida_hz, 38.5 * fator, places=3)
        self.assertAlmostEqual(est.base_alvo_hz, 38.5, places=3)

    def test_sugestao_ignorada_nao_acumula(self):
        # Operador não aplicou: a janela segue na base antiga e a sugestão se repete igual.
        s1, e1 = modelo.sugerir_por_amostra(P, leitura(40.0), EstadoControle(), 13.5, T0, T0, 0.5,
                                            base_janela_hz=40.0)
        t1 = T0 + timedelta(minutes=20)
        s2, _ = modelo.sugerir_por_amostra(P, leitura(40.0, quando=t1), e1, 13.5, t1, t1, 0.5,
                                           base_janela_hz=40.0)
        self.assertAlmostEqual(s1.velocidade_sugerida_hz, s2.velocidade_sugerida_hz, places=6)

    def test_dentro_da_banda_ainda_compensa_vapor(self):
        # Amostra boa, mas o vapor caiu depois que esta massa passou: reduzir mesmo assim.
        f8 = modelo.fator_vapor(tsat_pressao_manometrica(8.0), P)
        f65 = modelo.fator_vapor(tsat_pressao_manometrica(6.5), P)
        sug, _ = modelo.sugerir_por_amostra(P, leitura(40.0, 6.5), EstadoControle(), 12.0, T0, T0, 0.5,
                                            base_janela_hz=40.0 / f8)
        self.assertEqual(sug.acao, modelo.REDUZIR)
        self.assertAlmostEqual(sug.velocidade_sugerida_hz, 40.0 * f65 / f8, places=3)
        self.assertIn("Compensação de vapor", sug.motivo)

    def test_sem_janela_avisa(self):
        sug, _ = self.sugerir(13.0)
        self.assertTrue(any("janela" in a for a in sug.avisos))

    def test_forno_parado_e_sem_vapor(self):
        sug, _ = modelo.sugerir_por_amostra(P, leitura(rodando=False), EstadoControle(), 13, T0, T0, 0.5)
        self.assertEqual(sug.acao, modelo.FORNO_PARADO)
        sug, _ = modelo.sugerir_por_amostra(P, leitura(p_bar=0.0), EstadoControle(), 13, T0, T0, 0.5)
        self.assertEqual(sug.acao, modelo.SEM_VAPOR)

    def test_leitura_desatualizada(self):
        velha = leitura(quando=T0 - timedelta(minutes=10))
        sug, _ = modelo.sugerir_por_amostra(P, velha, EstadoControle(), 13, T0, T0, 0.5, 120)
        self.assertEqual(sug.acao, modelo.SEM_DADOS)


class TestVaporAoVivo(unittest.TestCase):
    def test_queda_de_vapor_reduz_rotacao(self):
        _, est = modelo.sugerir_por_amostra(P, leitura(40, 8.0), EstadoControle(), 12.0, T0, T0, 0.5)
        t1 = T0 + timedelta(minutes=5)
        sug = modelo.sugerir_por_vapor(P, leitura(40, 6.0, quando=t1), est, t1)
        tsat8, tsat6 = tsat_pressao_manometrica(8.0), tsat_pressao_manometrica(6.0)
        esperado = 40 * (tsat6 - 100) / (tsat8 - 100)
        self.assertEqual(sug.acao, modelo.REDUZIR)
        self.assertAlmostEqual(sug.velocidade_sugerida_hz, esperado, places=3)
        self.assertIn("vapor caiu", sug.motivo)

    def test_sem_amostra_mantem(self):
        sug = modelo.sugerir_por_vapor(P, leitura(), EstadoControle(), T0)
        self.assertEqual(sug.acao, modelo.MANTER)
        self.assertTrue(sug.avisos)

    def test_aviso_amostra_vencida(self):
        est = EstadoControle(base_alvo_hz=40, fator_ref=1, ultima_amostra_em=T0 - timedelta(minutes=50))
        sug = modelo.sugerir_por_vapor(P, leitura(), est, T0)
        self.assertTrue(any("nova amostra" in a for a in sug.avisos))


class TestAprendizado(unittest.TestCase):
    def test_recupera_k(self):
        pontos = [(30 + i * 0.5, 2.0 + 0.4 * (30 + i * 0.5) + (0.1 if i % 2 else -0.1)) for i in range(20)]
        est = estimar_k(pontos)
        self.assertTrue(est.confiavel, est.motivo)
        self.assertAlmostEqual(est.k, 0.4, delta=0.03)

    def test_sem_variacao_de_rotacao(self):
        est = estimar_k([(40.0, 12 + i * 0.01) for i in range(20)])
        self.assertFalse(est.confiavel)

    def test_poucas_amostras(self):
        est = estimar_k([(30, 10), (35, 12), (40, 14), (45, 16)])
        self.assertFalse(est.confiavel)
        self.assertIn("poucas amostras", est.motivo)


class TestConfig(unittest.TestCase):
    def test_carrega_json_padrao(self):
        import os
        caminho = os.path.join(os.path.dirname(__file__), "..", "config", "fornos.json")
        fornos = carregar_fornos(caminho)
        self.assertEqual(set(fornos), {"Forno 01", "Forno 02"})
        self.assertEqual(fornos["Forno 02"].umidade_alvo, 12.0)

    def test_normaliza_nomes(self):
        fornos = {"Forno 01": P, "Forno 02": P}
        self.assertEqual(normalizar_forno("forno 1", fornos), "Forno 01")
        self.assertEqual(normalizar_forno("F2", fornos), "Forno 02")
        self.assertEqual(normalizar_forno("FORNO 01", fornos), "Forno 01")
        self.assertIsNone(normalizar_forno("Forno 3", fornos))
        self.assertIsNone(normalizar_forno("", fornos))


if __name__ == "__main__":
    unittest.main()
