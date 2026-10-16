"""Banco dos testes: SQLite em memória, ou MySQL se TEST_BANCO_URL estiver definido.

    TEST_BANCO_URL=mysql://usuario:senha@host:3306/controle_umidade_teste python -m unittest discover -s tests -t .
"""

import os

from app.banco import Banco


def banco_teste() -> Banco:
    url = os.environ.get("TEST_BANCO_URL")
    if not url:
        return Banco(":memory:")
    Banco(url).apagar_tudo()
    return Banco(url)
