"""Leitura dos valores ao vivo pelo Redis (servidor RESP falso, sem Redis instalado)."""

import json
import socketserver
import threading
import unittest

from app.coletor import Coletor
from app.config import ConfigServico, ParametrosForno
from app.redis_simples import ErroRedis, RedisSimples
from app.servico import ServicoUmidade
from tests.base import banco_teste

DADOS = {"chave": json.dumps({"fornos": [
    {"forno": "Forno 01", "velocidade_hz": 40, "rosca_hz": 30.5, "pressao_vapor_bar": 7.8, "rodando": True},
]})}
SENHA = "segredo"


class RedisFalso(socketserver.StreamRequestHandler):
    def ler_comando(self):
        cab = self.rfile.readline()
        if not cab:
            return None
        n = int(cab[1:])
        args = []
        for _ in range(n):
            tam = int(self.rfile.readline()[1:])
            args.append(self.rfile.read(tam + 2)[:-2].decode())
        return args

    def handle(self):
        autenticado = False
        while True:
            c = self.ler_comando()
            if c is None:
                return
            cmd = c[0].upper()
            if cmd == "AUTH":
                autenticado = c[-1] == SENHA
                self.wfile.write(b"+OK\r\n" if autenticado else b"-WRONGPASS invalid password\r\n")
            elif not autenticado:
                self.wfile.write(b"-NOAUTH Authentication required.\r\n")
            elif cmd == "SELECT":
                self.wfile.write(b"+OK\r\n")
            elif cmd == "GET":
                v = DADOS.get(c[1])
                if v is None:
                    self.wfile.write(b"$-1\r\n")
                else:
                    b = v.encode()
                    self.wfile.write(b"$%d\r\n%s\r\n" % (len(b), b))
            else:
                self.wfile.write(b"-ERR unknown\r\n")


class TestRedis(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), RedisFalso)
        cls.srv.daemon_threads = True
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.porta = cls.srv.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_get_com_senha_e_banco(self):
        r = RedisSimples(f"redis://:{SENHA}@127.0.0.1:{self.porta}/2?chave=chave")
        self.assertIn("Forno 01", r.get())
        self.assertIsNone(r.get("nao-existe"))

    def test_senha_errada(self):
        with self.assertRaises(ErroRedis):
            RedisSimples(f"redis://:errada@127.0.0.1:{self.porta}/0?chave=chave").get()

    def test_coletor_le_do_redis(self):
        cfg = ConfigServico(fonte_processo_url=f"redis://:{SENHA}@127.0.0.1:{self.porta}/2?chave=chave")
        s = ServicoUmidade(cfg, {"Forno 01": ParametrosForno(nome="Forno 01", manipulada="alimentacao")}, banco_teste())
        Coletor(s).ler_processo_uma_vez()
        lido = s.leitura("Forno 01")
        self.assertEqual((lido.velocidade_hz, lido.alimentacao_hz, lido.pressao_bar), (40, 30.5, 7.8))

    def test_chave_expirada_e_erro_claro(self):
        cfg = ConfigServico(fonte_processo_url=f"redis://:{SENHA}@127.0.0.1:{self.porta}/2?chave=sumiu")
        s = ServicoUmidade(cfg, {"Forno 01": ParametrosForno(nome="Forno 01")}, banco_teste())
        with self.assertRaisesRegex(ValueError, "expirada"):
            Coletor(s).ler_processo_uma_vez()


if __name__ == "__main__":
    unittest.main()
