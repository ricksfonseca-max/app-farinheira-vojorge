"""Cliente Redis mínimo (só o necessário: AUTH, SELECT, GET), sem dependências.

URL: redis://[:senha@]host:6379/banco?chave=umidade:fornos
"""

from __future__ import annotations

import socket
from urllib.parse import parse_qs, unquote, urlparse


class ErroRedis(Exception):
    pass


class RedisSimples:
    def __init__(self, url: str, timeout: float = 5.0):
        u = urlparse(url)
        if u.scheme != "redis":
            raise ValueError("URL do Redis deve começar com redis://")
        self.host = u.hostname or "localhost"
        self.porta = u.port or 6379
        self.senha = unquote(u.password) if u.password else None
        self.usuario = unquote(u.username) if u.username else None
        self.db = int((u.path or "/0").lstrip("/") or 0)
        self.chave = parse_qs(u.query).get("chave", ["umidade:fornos"])[0]
        self.timeout = timeout

    @staticmethod
    def _montar(*args) -> bytes:
        partes = [f"*{len(args)}\r\n".encode()]
        for a in args:
            b = a if isinstance(a, bytes) else str(a).encode("utf-8")
            partes.append(b"$%d\r\n%s\r\n" % (len(b), b))
        return b"".join(partes)

    @staticmethod
    def _ler(f):
        linha = f.readline()
        if not linha:
            raise ErroRedis("conexão fechada pelo Redis")
        tipo, resto = linha[:1], linha[1:].rstrip(b"\r\n")
        if tipo == b"+":
            return resto.decode()
        if tipo == b"-":
            raise ErroRedis(resto.decode())
        if tipo == b":":
            return int(resto)
        if tipo == b"$":
            n = int(resto)
            if n < 0:
                return None
            dados = f.read(n + 2)
            return dados[:-2].decode("utf-8")
        if tipo == b"*":
            n = int(resto)
            return None if n < 0 else [RedisSimples._ler(f) for _ in range(n)]
        raise ErroRedis(f"resposta inesperada: {linha[:40]!r}")

    def comandos(self, *lista: tuple) -> list:
        """Abre conexão, autentica, seleciona o banco, executa os comandos e fecha."""
        with socket.create_connection((self.host, self.porta), timeout=self.timeout) as s:
            f = s.makefile("rb")
            preparo = []
            if self.senha:
                preparo.append(("AUTH", self.usuario, self.senha) if self.usuario else ("AUTH", self.senha))
            if self.db:
                preparo.append(("SELECT", self.db))
            todos = preparo + list(lista)
            s.sendall(b"".join(self._montar(*c) for c in todos))
            respostas = [self._ler(f) for _ in todos]
            return respostas[len(preparo):]

    def get(self, chave: str | None = None) -> str | None:
        return self.comandos(("GET", chave or self.chave))[0]
