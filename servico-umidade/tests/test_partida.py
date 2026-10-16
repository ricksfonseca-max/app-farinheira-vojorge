"""Partida do serviço (python -m app): o que os outros testes não cobrem."""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

from app.__main__ import ocultar_senha, preparar_destino

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestPartida(unittest.TestCase):
    def test_mysql_nao_cria_pasta(self):
        atual = os.getcwd()
        with tempfile.TemporaryDirectory() as d:
            os.chdir(d)
            try:
                preparar_destino("mysql://umidade:abc@mysql:3306/controle_umidade")
                preparar_destino(":memory:")
                self.assertEqual(os.listdir(d), [])
                preparar_destino(os.path.join(d, "sub", "umidade.db"))
                self.assertTrue(os.path.isdir(os.path.join(d, "sub")))
            finally:
                os.chdir(atual)

    def test_senha_nao_vai_para_o_log(self):
        self.assertEqual(ocultar_senha("mysql://umidade:Segredo123@mysql:3306/controle_umidade"),
                         "mysql://umidade:***@mysql:3306/controle_umidade")
        self.assertEqual(ocultar_senha("redis://:outra@redis:6379/3?chave=umidade:fornos"),
                         "redis://:***@redis:6379/3?chave=umidade:fornos")
        self.assertEqual(ocultar_senha("http://host.docker.internal:1880/api/fornos"),
                         "http://host.docker.internal:1880/api/fornos")
        self.assertEqual(ocultar_senha(""), "-")

    def test_processo_sobe_e_responde(self):
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            porta = s.getsockname()[1]
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ, PORTA=str(porta), BANCO=os.path.join(d, "x", "umidade.db"),
                       CONFIG_FORNOS=os.path.join(RAIZ, "config", "fornos.json"), FONTE_PROCESSO_URL="")
            p = subprocess.Popen([sys.executable, "-m", "app"], cwd=RAIZ, env=env,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            try:
                for _ in range(50):
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:{porta}/api/fornos", timeout=1) as r:
                            dados = json.loads(r.read())
                        break
                    except OSError:
                        time.sleep(0.1)
                else:
                    self.fail("serviço não respondeu: " + p.stdout.read1(4000).decode(errors="replace"))
                self.assertEqual([f["forno"] for f in dados["fornos"]], ["Forno 01", "Forno 02"])
            finally:
                p.terminate()
                p.wait(timeout=10)


if __name__ == "__main__":
    unittest.main()
