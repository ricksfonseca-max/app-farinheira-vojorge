"""Tarefas em segundo plano: lê rotação/vapor no Node-RED e sincroniza apontamentos."""

from __future__ import annotations

import json
import logging
import threading
import time
import urllib.request

from .servico import ServicoUmidade

log = logging.getLogger("coletor")


def buscar_json(url: str, timeout: float):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _num(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def interpretar_fornos(dados) -> list[dict]:
    """Aceita {"fornos": [...]}, uma lista, ou {"Forno 01": {...}, ...}."""
    if isinstance(dados, dict) and "fornos" in dados:
        dados = dados["fornos"]
    itens: list[dict] = []
    if isinstance(dados, dict):
        for nome, v in dados.items():
            if isinstance(v, dict):
                itens.append({"forno": nome, **v})
    elif isinstance(dados, list):
        itens = [v for v in dados if isinstance(v, dict)]
    saida = []
    for v in itens:
        vel = _num(v.get("velocidade_hz", v.get("velocidade")))
        pres = _num(v.get("pressao_vapor_bar", v.get("pressao_bar", v.get("pressao"))))
        temp = _num(v.get("temp_saida_produto_c", v.get("temp_saida_c")))
        rodando = v.get("rodando")
        if rodando is None:
            rodando = vel is not None and vel >= 1.0
        saida.append({"forno": v.get("forno"), "velocidade_hz": vel, "pressao_bar": pres,
                      "temp_saida_c": temp, "rodando": bool(rodando)})
    return saida


class Coletor:
    def __init__(self, servico: ServicoUmidade):
        self.servico = servico
        self.cfg = servico.cfg
        self._parar = threading.Event()
        self._threads: list[threading.Thread] = []

    def iniciar(self) -> None:
        if self.cfg.fonte_processo_url:
            self._threads.append(threading.Thread(target=self._loop_processo, name="processo", daemon=True))
        else:
            log.warning("FONTE_PROCESSO_URL não definida: sem leitura de rotação/vapor.")
        if self.cfg.registros_url:
            self._threads.append(threading.Thread(target=self._loop_registros, name="registros", daemon=True))
        for t in self._threads:
            t.start()

    def parar(self) -> None:
        self._parar.set()
        for t in self._threads:
            t.join(timeout=5)

    def ler_processo_uma_vez(self) -> None:
        dados = buscar_json(self.cfg.fonte_processo_url, self.cfg.timeout_http_s)
        fornos = interpretar_fornos(dados)
        if not fornos:
            raise ValueError("resposta sem fornos")
        reconhecidos = 0
        sem_dado = []
        for f in fornos:
            if f["velocidade_hz"] is None and f["pressao_bar"] is None:
                # Node-RED sem leitura válida do CLP: não grava nada; a leitura
                # anterior vence e a sugestão passa a "SEM DADOS" (não "parado").
                sem_dado.append(f["forno"])
                continue
            reconhecidos += self.servico.registrar_leitura(
                f["forno"], f["velocidade_hz"], f["pressao_bar"], f["rodando"], temp_saida_c=f["temp_saida_c"])
        if sem_dado:
            log.warning("Sem leitura válida do CLP para: %s", ", ".join(map(str, sem_dado)))
        if not reconhecidos:
            if sem_dado:
                raise ValueError("Node-RED sem leitura válida do CLP")
            raise ValueError(f"nenhum forno reconhecido em {[f['forno'] for f in fornos]}")
        self.servico.atualizar_sugestoes_vapor()

    def _loop_processo(self) -> None:
        ultima_verificacao = 0.0
        while not self._parar.is_set():
            try:
                self.ler_processo_uma_vez()
                self.servico.ultima_coleta_ok = self.servico.relogio()
                self.servico.ultimo_erro_coleta = None
            except Exception as e:  # noqa: BLE001 — o laço nunca pode morrer
                self.servico.ultimo_erro_coleta = f"{type(e).__name__}: {e}"
                log.warning("Falha ao ler processo: %s", self.servico.ultimo_erro_coleta)
                try:
                    self.servico.atualizar_sugestoes_vapor()  # registra "sem dados" quando vencer
                except Exception:  # noqa: BLE001
                    log.exception("Falha ao atualizar sugestões")
            if time.monotonic() - ultima_verificacao > 60:
                try:
                    self.servico.verificar_aplicacao()
                except Exception:  # noqa: BLE001
                    log.exception("Falha ao verificar aplicação das sugestões")
                ultima_verificacao = time.monotonic()
            self._parar.wait(self.cfg.intervalo_leitura_s)

    def _loop_registros(self) -> None:
        self._parar.wait(10)  # deixa as primeiras leituras chegarem
        while not self._parar.is_set():
            try:
                dados = buscar_json(self.cfg.registros_url, max(self.cfg.timeout_http_s, 30))
                if isinstance(dados, dict):
                    dados = dados.get("registros", dados.get("dados", []))
                novos = self.servico.sincronizar_registros(dados if isinstance(dados, list) else [])
                if novos:
                    log.info("Sincronização: %d apontamento(s) novo(s)", novos)
            except Exception as e:  # noqa: BLE001
                log.warning("Falha ao sincronizar registros: %s", e)
            self._parar.wait(self.cfg.intervalo_sync_s)
