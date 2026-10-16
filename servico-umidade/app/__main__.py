"""Ponto de entrada: python -m app"""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading

from .banco import Banco
from .coletor import Coletor
from .config import ConfigServico, carregar_fornos
from .servico import ServicoUmidade
from .servidor import criar_servidor


def main() -> int:
    logging.basicConfig(
        level=os.environ.get("NIVEL_LOG", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    log = logging.getLogger("servico-umidade")
    cfg = ConfigServico.do_ambiente()
    fornos = carregar_fornos(cfg.config_fornos)
    os.makedirs(os.path.dirname(os.path.abspath(cfg.banco)), exist_ok=True)
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
             ", ".join(fornos), cfg.fonte_processo_url or "-", cfg.registros_url or "-", cfg.banco)
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
