"""Ponto de entrada: python -m app"""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading
from urllib.parse import urlparse, urlunparse

from .banco import Banco
from .coletor import Coletor
from .config import ConfigServico, carregar_fornos
from .servico import ServicoUmidade
from .servidor import criar_servidor


def preparar_destino(destino: str) -> None:
    """Cria a pasta do arquivo SQLite. Para MySQL (ou banco em memória) não há nada a criar."""
    if "://" in destino or destino == ":memory:":
        return
    os.makedirs(os.path.dirname(os.path.abspath(destino)), exist_ok=True)


def ocultar_senha(url: str) -> str:
    """mysql://u:segredo@h/db -> mysql://u:***@h/db (para não vazar senha no log)."""
    if not url or "://" not in url:
        return url or "-"
    u = urlparse(url)
    if not u.password:
        return url
    netloc = f"{u.username or ''}:***@{u.hostname}" + (f":{u.port}" if u.port else "")
    return urlunparse(u._replace(netloc=netloc))


def main() -> int:
    logging.basicConfig(
        level=os.environ.get("NIVEL_LOG", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    log = logging.getLogger("servico-umidade")
    cfg = ConfigServico.do_ambiente()
    fornos = carregar_fornos(cfg.config_fornos)
    preparar_destino(cfg.banco)
    banco = Banco(cfg.banco)
    servico = ServicoUmidade(cfg, fornos, banco)
    coletor = Coletor(servico)
    servidor = criar_servidor(servico)

    def encerrar(*_):
        log.info("Encerrando...")
        threading.Thread(target=servidor.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, encerrar)
    signal.signal(signal.SIGINT, encerrar)

    log.info("Fornos: %s | processo: %s | registros: %s | banco: %s",
             ", ".join(fornos), ocultar_senha(cfg.fonte_processo_url), ocultar_senha(cfg.registros_url),
             ocultar_senha(cfg.banco))
    coletor.iniciar()
    log.info("API ouvindo na porta %d", cfg.porta)
    try:
        servidor.serve_forever(poll_interval=0.5)
    finally:
        coletor.parar()
        servidor.server_close()
        banco.fechar()
    return 0


if __name__ == "__main__":
    sys.exit(main())
