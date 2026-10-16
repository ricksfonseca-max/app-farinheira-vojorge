"""Simulação de um turno inteiro: forno virtual + operador que segue as sugestões."""

import unittest
from collections import deque
from datetime import datetime, timedelta, timezone

from app import modelo
from app.banco import Banco  # noqa: F401
from tests.base import banco_teste
from app.config import ConfigServico, ParametrosForno
from app.modelo import fator_vapor
from app.servico import ServicoUmidade, ler_data
from app.vapor import tsat_pressao_manometrica

T0 = datetime(2026, 10, 16, 6, 0, tzinfo=timezone.utc)
PASSO_S = 15


class Relogio:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


class FornoVirtual:
    """Umidade de saída = a + K_real × média(rotação/fator_vapor) durante a residência + perturbação."""

    def __init__(self, p: ParametrosForno, k_real=0.6, f0=40.0, p0=8.0):
        self.p = p
        self.k_real = k_real
        self.f = f0
        self.pressao = p0
        self.perturbacao = 0.0
        base0 = f0 / fator_vapor(tsat_pressao_manometrica(p0), p)
        self.a = p.umidade_alvo - k_real * base0
        n = int(p.t_residencia_min * 60 / PASSO_S)
        self.janela = deque([base0] * n, maxlen=n)
        self.saida = deque(maxlen=int((p.t_coleta_min * 60) / PASSO_S) + 1)

    def passo(self):
        fator = fator_vapor(tsat_pressao_manometrica(self.pressao), self.p)
        self.janela.append(self.f / fator)
        u = self.a + self.k_real * (sum(self.janela) / len(self.janela)) + self.perturbacao
        self.saida.append(u)

    def amostra(self):
        return self.saida[0]  # o que saiu do forno t_coleta minutos atrás


def novo_servico(p=None):
    p = p or ParametrosForno(nome="Forno 01")
    relogio = Relogio(T0)
    cfg = ConfigServico(intervalo_leitura_s=PASSO_S, leitura_validade_s=120, janela_aplicacao_min=15)
    return ServicoUmidade(cfg, {"Forno 01": p}, banco_teste(), relogio), relogio, p


class TestSimulacao(unittest.TestCase):
    def rodar(self, horas, eventos, seguir=True):
        servico, relogio, p = novo_servico()
        forno = FornoVirtual(p)
        historico = []
        passos = int(horas * 3600 / PASSO_S)
        for i in range(passos):
            t = T0 + timedelta(seconds=i * PASSO_S)
            relogio.t = t
            for quando_h, acao in eventos:
                if i == int(quando_h * 3600 / PASSO_S):
                    acao(forno)
            forno.passo()
            servico.registrar_leitura("Forno 01", forno.f, forno.pressao, True, t)
            servico.atualizar_sugestoes_vapor()
            if i % int(20 * 60 / PASSO_S) == 0 and i > 0:
                u = round(forno.amostra(), 1)  # operador mede com 1 casa decimal
                res = servico.processar_amostra("Forno 01", u, t, responsavel="sim")
                historico.append((t, u, res["sugestao"]["acao"]))
                if seguir and res["sugestao"]["acao"] in (modelo.AUMENTAR, modelo.REDUZIR):
                    forno.f = res["sugestao"]["velocidade_sugerida_hz"]
            elif seguir and i % 4 == 0:
                sug = servico.sugestao_atual("Forno 01")
                if sug.acao in (modelo.AUMENTAR, modelo.REDUZIR):
                    forno.f = sug.velocidade_sugerida_hz
            if i % 4 == 0:
                servico.verificar_aplicacao()
        return servico, historico

    def test_rejeita_perturbacao_de_entrada(self):
        def massa_mais_umida(f):
            f.perturbacao = 1.5

        servico, hist = self.rodar(8, [(1.0, massa_mais_umida)])
        finais = [u for t, u, _ in hist if t >= T0 + timedelta(hours=6)]
        self.assertTrue(finais)
        for u in finais:
            self.assertLess(abs(u - 12.0), 0.5, f"umidade final fora: {finais}")
        acoes = [a for _, _, a in hist]
        self.assertIn(modelo.REDUZIR, acoes)
        # Sem oscilação: depois de começar a reduzir, não deve mandar aumentar.
        self.assertNotIn(modelo.AUMENTAR, acoes, f"oscilou: {hist}")
        menor = min(u for _, u, _ in hist if _ is not None)
        self.assertGreater(menor, 11.5, f"sobre-correção: {hist}")

    def test_operador_ignorando_nao_acumula(self):
        def massa_mais_umida(f):
            f.perturbacao = 1.5

        servico, _ = self.rodar(5, [(1.0, massa_mais_umida)], seguir=False)
        sugeridas = [r["velocidade_sugerida_hz"] for r in servico.banco.consultar(
            "SELECT velocidade_sugerida_hz FROM sugestoes WHERE origem = 'amostra' AND acao = 'reduzir' "
            "AND calculada_em >= '2026-10-16T08:30:00+00:00' ORDER BY id")]
        self.assertGreater(len(sugeridas), 2)
        self.assertLess(max(sugeridas) - min(sugeridas), 0.2, sugeridas)  # mesma sugestão, sem empilhar

    def test_feedforward_compensa_queda_de_vapor(self):
        def vapor_cai(f):
            f.pressao = 6.5

        _, com = self.rodar(6, [(2.0, vapor_cai)], seguir=True)
        _, sem = self.rodar(6, [(2.0, vapor_cai)], seguir=False)
        desvio_com = max(abs(u - 12) for t, u, _ in com if t > T0 + timedelta(hours=2))
        desvio_sem = max(abs(u - 12) for t, u, _ in sem if t > T0 + timedelta(hours=2))
        self.assertGreater(desvio_sem, 1.0)          # sem ação, a farinha sai úmida
        self.assertLess(desvio_com, 0.5)             # seguindo a sugestão, quase nada
        self.assertLess(desvio_com, desvio_sem / 3)

    def test_registra_aplicacao_e_dados_para_aprendizado(self):
        def massa_mais_umida(f):
            f.perturbacao = 1.5

        servico, _ = self.rodar(8, [(1.0, massa_mais_umida)])
        aval = servico.banco.consultar(
            "SELECT aplicada FROM sugestoes WHERE acao IN ('aumentar','reduzir') AND aplicada IS NOT NULL")
        self.assertTrue(aval)
        self.assertTrue(all(a["aplicada"] == 1 for a in aval))
        estaveis = servico.banco.um("SELECT COUNT(*) n FROM amostras WHERE janela_estavel = 1")["n"]
        self.assertGreater(estaveis, 5)


class TestServico(unittest.TestCase):
    def test_amostra_duplicada(self):
        servico, relogio, _ = novo_servico()
        servico.registrar_leitura("Forno 01", 40, 8, True, T0)
        r1 = servico.processar_amostra("forno 1", 12.0, T0)
        r2 = servico.processar_amostra("Forno 01", 12.0, T0 + timedelta(seconds=20))
        self.assertFalse(r1["duplicada"])
        self.assertTrue(r2["duplicada"])
        self.assertEqual(r1["amostra_id"], r2["amostra_id"])

    def test_forno_desconhecido(self):
        servico, _, _ = novo_servico()
        with self.assertRaises(ValueError):
            servico.processar_amostra("Forno 9", 12.0)

    def test_sincroniza_registros_do_nodered(self):
        servico, relogio, _ = novo_servico()
        relogio.t = T0 + timedelta(hours=1)
        servico.registrar_leitura("Forno 01", 40, 8, True, relogio.t)
        regs = [
            {"id": 1, "forno": "Forno 01", "umidade": "12.4", "data_hora": "2026-10-16 03:30:00"},  # local -03
            {"id": 2, "forno": "Forno 01", "umidade": 12.9, "data_hora": "2026-10-16T06:50:00.000Z"},
            {"id": 3, "forno": "Forno 05", "umidade": 12.0, "data_hora": "2026-10-16T06:50:00Z"},
            {"id": 4, "forno": "Forno 01", "umidade": None, "data_hora": "2026-10-16T06:55:00Z"},
            {"id": 5, "forno": "Forno 01", "umidade": 11.0, "data_hora": "2026-10-10T06:55:00Z"},  # antigo
        ]
        self.assertEqual(servico.sincronizar_registros(regs), 2)
        self.assertEqual(servico.sincronizar_registros(regs), 0)  # idempotente
        primeira = servico.banco.um("SELECT coletada_em FROM amostras ORDER BY coletada_em LIMIT 1")
        self.assertEqual(primeira["coletada_em"], "2026-10-16T06:30:00+00:00")

    def test_amostra_no_futuro(self):
        servico, _, _ = novo_servico()
        with self.assertRaises(ValueError):
            servico.processar_amostra("Forno 01", 12.0, T0 + timedelta(hours=1))

    def test_mudanca_de_rotacao_e_parada(self):
        servico, relogio, _ = novo_servico()
        servico.registrar_leitura("Forno 01", 40, 8, True, T0)
        est, _ = servico._carregar_estado("Forno 01")
        self.assertIsNone(est.ultima_mudanca_velocidade_em)  # primeira leitura não é mudança
        t1 = T0 + timedelta(minutes=1)
        servico.registrar_leitura("Forno 01", 40.3, 8, True, t1)
        est, _ = servico._carregar_estado("Forno 01")
        self.assertIsNone(est.ultima_mudanca_velocidade_em)  # abaixo do limiar
        t2 = T0 + timedelta(minutes=2)
        servico.registrar_leitura("Forno 01", 42, 8, True, t2)
        est, _ = servico._carregar_estado("Forno 01")
        self.assertEqual(est.ultima_mudanca_velocidade_em, t2)
        t3 = T0 + timedelta(minutes=3)
        servico.registrar_leitura("Forno 01", 0, 8, False, t3)
        t4 = T0 + timedelta(minutes=30)
        servico.registrar_leitura("Forno 01", 42, 8, True, t4)
        est, _ = servico._carregar_estado("Forno 01")
        self.assertEqual(est.ultima_mudanca_velocidade_em, t4)  # religou = mudança

    def test_estado_geral_serializavel(self):
        import json
        servico, _, _ = novo_servico()
        servico.registrar_leitura("Forno 01", 40, 8, True, T0)
        servico.processar_amostra("Forno 01", 13.0, T0)
        dados = servico.estado_geral()
        json.dumps(dados)
        f = dados["fornos"][0]
        self.assertEqual(f["sugestao"]["acao"], modelo.REDUZIR)
        self.assertEqual(f["proxima_amostra_em"], "2026-10-16T06:20:00+00:00")


class TestLerData(unittest.TestCase):
    def test_formatos(self):
        fuso = timezone(timedelta(hours=-3))
        self.assertEqual(ler_data("2026-10-16T10:00:00Z", fuso), datetime(2026, 10, 16, 10, tzinfo=timezone.utc))
        self.assertEqual(ler_data("2026-10-16 07:00:00", fuso), datetime(2026, 10, 16, 10, tzinfo=timezone.utc))
        self.assertEqual(ler_data(1760608800000, fuso), ler_data(1760608800, fuso))
        self.assertIsNone(ler_data("", fuso))


if __name__ == "__main__":
    unittest.main()
