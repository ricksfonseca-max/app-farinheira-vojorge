"""Setpoint por forno, modo da planta (linha de base / conselheiro), PT100 e séries dos gráficos."""

import json
import threading
import unittest
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from app import modelo
from app.banco import Banco  # noqa: F401
from tests.base import banco_teste
from app.config import ConfigServico, ParametrosForno
from app.servico import ServicoUmidade
from app.servidor import criar_servidor

T0 = datetime(2026, 10, 16, 10, 0, tzinfo=timezone.utc)


class Relogio:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


def novo(pin=""):
    relogio = Relogio(T0)
    fornos = {"Forno 01": ParametrosForno(nome="Forno 01"), "Forno 02": ParametrosForno(nome="Forno 02")}
    cfg = ConfigServico(intervalo_leitura_s=15, senha_supervisor=pin)
    return ServicoUmidade(cfg, fornos, banco_teste(), relogio), relogio


def semear(s, relogio, minutos=40, v=40.0, p=8.0, temp=None):
    for i in range(minutos * 4, -1, -1):
        t = relogio.t - timedelta(seconds=15 * i)
        s.registrar_leitura("Forno 01", v, p, True, t, temp_saida_c=temp)


class TestSetpoint(unittest.TestCase):
    def test_padrao_vem_da_configuracao(self):
        s, _ = novo()
        sp = s.setpoint_atual("Forno 01")
        self.assertEqual(sp["umidade_alvo"], 12.0)
        self.assertEqual(sp["origem"], "configuracao")

    def test_alterar_vale_so_para_o_forno(self):
        s, _ = novo()
        s.alterar_setpoint("Forno 01", "12,5", "Rick", "teste")
        self.assertEqual(s.params("Forno 01").umidade_alvo, 12.5)
        self.assertEqual(s.params("Forno 02").umidade_alvo, 12.0)
        self.assertEqual(s.setpoint_atual("Forno 01")["alterado_por"], "Rick")

    def test_validacoes(self):
        s, _ = novo()
        with self.assertRaises(ValueError):
            s.alterar_setpoint("Forno 01", 25, "Rick")      # acima de setpoint_max
        with self.assertRaises(ValueError):
            s.alterar_setpoint("Forno 01", 12, "  ")        # sem usuário
        with self.assertRaises(ValueError):
            s.alterar_setpoint("Forno 01", "abc", "Rick")
        with self.assertRaises(ValueError):
            s.alterar_setpoint("Forno 9", 12, "Rick")

    def test_novo_setpoint_refaz_a_ultima_amostra(self):
        s, relogio = novo()
        semear(s, relogio)
        r = s.processar_amostra("Forno 01", 13.0, relogio.t)
        self.assertEqual(r["sugestao"]["acao"], modelo.REDUZIR)
        relogio.t += timedelta(minutes=2)
        s.registrar_leitura("Forno 01", 40.0, 8.0, True, relogio.t)
        estado = s.alterar_setpoint("Forno 01", 13.0, "Rick")
        # 13,0% agora é o alvo: a sugestão ao vivo volta a "manter" sem esperar nova amostra
        self.assertEqual(estado["sugestao"]["acao"], modelo.MANTER)
        ult = s.banco.um("SELECT origem, motivo FROM sugestoes ORDER BY id DESC LIMIT 1")
        self.assertEqual(ult["origem"], "setpoint")
        self.assertIn("Setpoint alterado para 13,0%", ult["motivo"])

    def test_amostra_grava_alvo_e_modo_vigentes(self):
        s, relogio = novo()
        semear(s, relogio)
        s.alterar_setpoint("Forno 01", 11.5, "Rick")
        s.processar_amostra("Forno 01", 12.0, relogio.t)
        a = s.banco.um("SELECT umidade_alvo, modo FROM amostras")
        self.assertEqual(a["umidade_alvo"], 11.5)
        self.assertEqual(a["modo"], "linha_base")


class TestModo(unittest.TestCase):
    def test_inicio_registrado_e_troca(self):
        s, relogio = novo()
        self.assertEqual(s.modo_atual()["modo"], "linha_base")
        self.assertEqual(s.banco.um("SELECT alterado_por FROM modos")["alterado_por"], "sistema")
        relogio.t += timedelta(days=21)
        m = s.alterar_modo("conselheiro", "Rick", "fim da linha de base")
        self.assertEqual(m["modo"], "conselheiro")
        s.alterar_modo("conselheiro", "Rick")  # repetido não duplica
        self.assertEqual(s.banco.um("SELECT COUNT(*) n FROM modos")["n"], 2)
        with self.assertRaises(ValueError):
            s.alterar_modo("automatico", "Rick")

    def test_resumo_por_modo(self):
        s, relogio = novo()
        semear(s, relogio, minutos=10)
        for i, u in enumerate([12.0, 13.0, 11.2, 12.4]):  # linha de base: 2 de 4 dentro de ±0,5
            relogio.t = T0 + timedelta(minutes=20 * (i + 1))
            s.registrar_leitura("Forno 01", 40, 8, True, relogio.t)
            s.processar_amostra("Forno 01", u, relogio.t)
        s.alterar_modo("conselheiro", "Rick")
        for i, u in enumerate([12.1, 11.9, 12.2]):
            relogio.t += timedelta(minutes=20)
            s.registrar_leitura("Forno 01", 40, 8, True, relogio.t)
            s.processar_amostra("Forno 01", u, relogio.t)
        r = s.resumo_umidade("Forno 01", T0 - timedelta(hours=1), relogio.t)
        self.assertEqual(r["geral"]["n"], 7)
        self.assertEqual(r["por_modo"]["linha_base"]["n"], 4)
        self.assertEqual(r["por_modo"]["linha_base"]["dentro_faixa_pct"], 50.0)
        self.assertEqual(r["por_modo"]["conselheiro"]["dentro_faixa_pct"], 100.0)
        self.assertLess(r["por_modo"]["conselheiro"]["desvio"], r["por_modo"]["linha_base"]["desvio"])


class TestSeriesEPt100(unittest.TestCase):
    def test_series(self):
        s, relogio = novo()
        semear(s, relogio, minutos=60, temp=61.5)
        s.processar_amostra("Forno 01", 12.6, relogio.t - timedelta(minutes=1))
        s.alterar_setpoint("Forno 01", 12.4, "Rick")
        d = s.series("Forno 01", horas=6)
        json.dumps(d)
        self.assertEqual(d["passo_min"], 1)
        self.assertGreaterEqual(len(d["leituras"]), 60)
        self.assertAlmostEqual(d["leituras"][-1]["velocidade_hz"], 40.0)
        self.assertEqual(d["leituras"][-1]["temp_saida_c"], 61.5)
        self.assertEqual([p["umidade_alvo"] for p in d["setpoints"]], [12.0, 12.4])
        self.assertEqual(len(d["amostras"]), 1)
        self.assertEqual(d["modos"][0]["modo"], "linha_base")
        self.assertEqual(s.estado_forno("Forno 01")["leitura"]["temp_saida_c"], 61.5)

    def test_forno_parado_vira_lacuna(self):
        s, relogio = novo()
        for i in range(0, 20):
            t = relogio.t - timedelta(minutes=20 - i)
            s.registrar_leitura("Forno 01", 0 if i < 10 else 40, 8, i >= 10, t)
        d = s.series("Forno 01", horas=1)
        self.assertIsNone(d["leituras"][0]["velocidade_hz"])
        self.assertEqual(d["leituras"][-1]["velocidade_hz"], 40)


class TestApiSupervisor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s, cls.relogio = novo(pin="4321")
        cls.relogio.t = datetime.now(timezone.utc)
        cls.api = criar_servidor(cls.s, "127.0.0.1", 0)
        threading.Thread(target=cls.api.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.api.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.api.shutdown()

    def pedir(self, caminho, dados=None):
        req = urllib.request.Request(self.base + caminho, data=None if dados is None else json.dumps(dados).encode(),
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_setpoint_exige_pin(self):
        st, corpo = self.pedir("/api/fornos/Forno%2001/setpoint", {"umidade_alvo": 12.3, "usuario": "Rick", "pin": "0000"})
        self.assertEqual(st, 403, corpo)
        st, corpo = self.pedir("/api/fornos/Forno%2001/setpoint", {"umidade_alvo": 12.3, "usuario": "Rick", "pin": "4321"})
        self.assertEqual(st, 200, corpo)
        self.assertEqual(corpo["setpoint"]["umidade_alvo"], 12.3)
        st, corpo = self.pedir("/api/fornos/Forno%2001/setpoint", {"umidade_alvo": 40, "usuario": "Rick", "pin": "4321"})
        self.assertEqual(st, 400)
        self.assertIn("entre", corpo["erro"])

    def test_modo_e_estado(self):
        st, corpo = self.pedir("/api/modo", {"modo": "conselheiro", "usuario": "Rick", "pin": "4321"})
        self.assertEqual((st, corpo["modo"]), (200, "conselheiro"))
        st, corpo = self.pedir("/api/fornos")
        self.assertTrue(corpo["pin_exigido"])
        self.assertEqual(corpo["modo"]["modo"], "conselheiro")
        st, corpo = self.pedir("/api/modo")
        self.assertEqual(len(corpo["historico"]), 2)

    def test_series_http(self):
        st, corpo = self.pedir("/api/series?forno=Forno%2002&horas=24")
        self.assertEqual(st, 200)
        self.assertEqual(corpo["passo_min"], 5)
        st, _ = self.pedir("/api/series?horas=24")
        self.assertEqual(st, 400)


if __name__ == "__main__":
    unittest.main()
