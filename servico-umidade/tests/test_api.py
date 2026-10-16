"""Teste ponta a ponta: Node-RED falso -> coletor -> API HTTP."""

import json
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from app.banco import Banco
from app.coletor import Coletor, interpretar_fornos
from app.config import ConfigServico, carregar_fornos
from app.servico import ServicoUmidade
from app.servidor import criar_servidor

ESTADO_NODERED = {
    "fornos": [
        {"forno": "Forno 01", "velocidade_hz": 40.0, "pressao_vapor_bar": 8.0, "rodando": True},
        {"forno": "Forno 02", "velocidade_hz": 35.0, "pressao_vapor_bar": 8.0, "rodando": True},
    ]
}
REGISTROS = [{"id": 99, "forno": "Forno 02", "umidade": 12.1, "data_hora": None, "foto": "x" * 1000}]


class NodeRedFalso(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):  # noqa: N802
        corpo = json.dumps(ESTADO_NODERED if self.path == "/api/fornos" else REGISTROS).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)


def pedir(url, dados=None, cabecalhos=None):
    req = urllib.request.Request(url, data=None if dados is None else json.dumps(dados).encode(),
                                 headers={"Content-Type": "application/json", **(cabecalhos or {})})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read(), r.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers


class TestApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from datetime import datetime, timezone
        REGISTROS[0]["data_hora"] = datetime.now(timezone.utc).isoformat()
        cls.nodered = ThreadingHTTPServer(("127.0.0.1", 0), NodeRedFalso)
        threading.Thread(target=cls.nodered.serve_forever, daemon=True).start()
        base_nr = f"http://127.0.0.1:{cls.nodered.server_port}"
        cfg = ConfigServico(
            porta=0, banco=":memory:", fonte_processo_url=f"{base_nr}/api/fornos",
            registros_url=f"{base_nr}/api/registros", intervalo_leitura_s=0.2, intervalo_sync_s=0.5,
            token_api="segredo",
        )
        import os
        fornos = carregar_fornos(os.path.join(os.path.dirname(__file__), "..", "config", "fornos.json"))
        cls.servico = ServicoUmidade(cfg, fornos, Banco(":memory:"))
        cls.coletor = Coletor(cls.servico)
        cls.coletor._parar.wait = lambda t=None: time.sleep(min(t or 0, 0.2)) or cls.coletor._parar.is_set()
        cls.api = criar_servidor(cls.servico, "127.0.0.1", 0)
        threading.Thread(target=cls.api.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.api.server_port}"
        cls.coletor.iniciar()
        for _ in range(50):
            if cls.servico.leitura("Forno 01") and cls.servico.leitura("Forno 02"):
                break
            time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.coletor.parar()
        cls.api.shutdown()
        cls.nodered.shutdown()

    def test_1_saude(self):
        st, corpo, _ = pedir(f"{self.base}/saude")
        self.assertEqual(st, 200, corpo)
        self.assertTrue(json.loads(corpo)["ok"])

    def test_2_estado_fornos(self):
        st, corpo, _ = pedir(f"{self.base}/api/fornos")
        self.assertEqual(st, 200)
        dados = json.loads(corpo)
        nomes = [f["forno"] for f in dados["fornos"]]
        self.assertEqual(nomes, ["Forno 01", "Forno 02"])
        f1 = dados["fornos"][0]
        self.assertEqual(f1["leitura"]["velocidade_hz"], 40.0)
        self.assertAlmostEqual(f1["leitura"]["tsat_c"], 175.4, delta=0.2)

    def test_3_post_amostra(self):
        st, _, _ = pedir(f"{self.base}/api/amostras", {"forno": "Forno 01", "umidade": 13.5})
        self.assertEqual(st, 401)  # sem token
        st, corpo, _ = pedir(f"{self.base}/api/amostras", {"forno": "Forno 01", "umidade": 13.5,
                                                           "responsavel": "Zé"}, {"X-Token": "segredo"})
        self.assertEqual(st, 201, corpo)
        res = json.loads(corpo)
        self.assertEqual(res["sugestao"]["acao"], "reduzir")
        self.assertLess(res["sugestao"]["velocidade_sugerida_hz"], 40)
        st, corpo, _ = pedir(f"{self.base}/api/fornos/Forno%2001")
        self.assertEqual(json.loads(corpo)["ultima_amostra"]["umidade"], 13.5)

    def test_4_erros(self):
        tok = {"X-Token": "segredo"}
        st, corpo, _ = pedir(f"{self.base}/api/amostras", {"forno": "Forno 7", "umidade": 12}, tok)
        self.assertEqual(st, 404)
        st, _, _ = pedir(f"{self.base}/api/amostras", {"forno": "Forno 01"}, tok)
        self.assertEqual(st, 400)
        st, _, _ = pedir(f"{self.base}/api/amostras", {"forno": "Forno 01", "umidade": "abc"}, tok)
        self.assertEqual(st, 400)
        st, _, _ = pedir(f"{self.base}/rota/inexistente")
        self.assertEqual(st, 404)

    def test_5_sincronizou_registro_do_nodered(self):
        for _ in range(30):
            if self.servico.banco.um("SELECT 1 x FROM amostras WHERE forno = 'Forno 02'"):
                break
            time.sleep(0.2)
        st, corpo, _ = pedir(f"{self.base}/api/amostras?forno=Forno%2002")
        linhas = json.loads(corpo)
        self.assertEqual(len(linhas), 1)
        self.assertEqual(linhas[0]["origem"], "sync")

    def test_6_exporta_csv(self):
        st, corpo, cab = pedir(f"{self.base}/api/exportar/leituras.csv?forno=Forno%2001")
        self.assertEqual(st, 200)
        texto = corpo.decode("utf-8-sig")
        linhas = texto.strip().splitlines()
        self.assertTrue(linhas[0].startswith("id;forno;lido_em"))
        self.assertIn(";40;", linhas[1])
        self.assertIn("attachment", cab["Content-Disposition"])

    def test_interpretar_formatos(self):
        a = interpretar_fornos({"Forno 01": {"velocidade": "41,0".replace(",", "."), "pressao": 7}})
        self.assertEqual(a[0]["velocidade_hz"], 41.0)
        self.assertTrue(a[0]["rodando"])
        b = interpretar_fornos([{"forno": "F2", "velocidade_hz": 0, "pressao_bar": 7}])
        self.assertFalse(b[0]["rodando"])


if __name__ == "__main__":
    unittest.main()
