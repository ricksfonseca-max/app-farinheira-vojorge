"""API HTTP (biblioteca padrão, sem dependências)."""

from __future__ import annotations

import csv
import io
import json
import logging
import math
from datetime import timedelta
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

from .banco import de_iso, iso
from .config import normalizar_forno
from .servico import ServicoUmidade, ler_data

log = logging.getLogger("api")

TAMANHO_MAX_CORPO = 64 * 1024
TABELAS_EXPORTAVEIS = {"amostras", "sugestoes", "leituras"}


class ErroApi(Exception):
    def __init__(self, status: int, mensagem: str):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


def criar_servidor(servico: ServicoUmidade, host: str = "0.0.0.0", porta: int | None = None) -> ThreadingHTTPServer:
    cfg = servico.cfg

    class Manipulador(BaseHTTPRequestHandler):
        server_version = "ServicoUmidade/1.0"

        # ------------------------------------------------------------ helpers
        def log_message(self, fmt, *args):  # noqa: N802
            log.info("%s %s", self.address_string(), fmt % args)

        def _cors(self):
            if cfg.cors_origem:
                self.send_header("Access-Control-Allow-Origin", cfg.cors_origem)
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Token")

        def _enviar(self, status: int, corpo: bytes, tipo: str, extra: dict | None = None):
            self.send_response(status)
            self.send_header("Content-Type", tipo)
            self.send_header("Content-Length", str(len(corpo)))
            self.send_header("Cache-Control", "no-store")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self._cors()
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(corpo)

        def _json(self, status: int, dados):
            corpo = json.dumps(dados, ensure_ascii=False, default=_padrao_json).encode("utf-8")
            self._enviar(status, corpo, "application/json; charset=utf-8")

        def _params(self) -> dict[str, str]:
            return {k: v[-1] for k, v in parse_qs(urlparse(self.path).query).items()}

        def _forno(self, valor: str | None, obrigatorio: bool = False) -> str | None:
            if not valor:
                if obrigatorio:
                    raise ErroApi(400, "Informe o forno")
                return None
            nome = normalizar_forno(valor, servico.fornos)
            if nome is None:
                raise ErroApi(404, f"Forno desconhecido: {valor}")
            return nome

        def _executar(self, func):
            try:
                func()
            except ErroApi as e:
                self._json(e.status, {"erro": e.mensagem})
            except ValueError as e:
                self._json(400, {"erro": str(e)})
            except Exception:  # noqa: BLE001
                log.exception("Erro na requisição %s %s", self.command, self.path)
                self._json(500, {"erro": "Erro interno do serviço"})

        # -------------------------------------------------------------- verbos
        def do_OPTIONS(self):  # noqa: N802
            self.send_response(HTTPStatus.NO_CONTENT)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):  # noqa: N802
            self._executar(self._rotear_get)

        def do_HEAD(self):  # noqa: N802
            self._executar(self._rotear_get)

        def do_POST(self):  # noqa: N802
            self._executar(self._rotear_post)

        # -------------------------------------------------------------- rotas
        def _rotear_get(self):
            caminho = urlparse(self.path).path.rstrip("/")
            q = self._params()

            if caminho in ("", "/saude"):
                ok = servico.ultima_coleta_ok
                atraso = None if ok is None else (servico.relogio() - ok).total_seconds()
                saudavel = atraso is not None and atraso <= cfg.leitura_validade_s
                return self._json(200 if saudavel or not cfg.fonte_processo_url else 503, {
                    "ok": saudavel, "ultima_coleta_ok": iso(ok), "atraso_s": atraso,
                    "ultimo_erro": servico.ultimo_erro_coleta, "fornos": list(servico.fornos),
                })

            if caminho == "/api/fornos":
                return self._json(200, servico.estado_geral())

            if caminho.startswith("/api/fornos/"):
                nome = self._forno(unquote(caminho.split("/", 3)[3]), obrigatorio=True)
                return self._json(200, servico.estado_forno(nome))

            if caminho in ("/api/sugestoes", "/api/amostras", "/api/leituras"):
                tabela = caminho.rsplit("/", 1)[1]
                return self._json(200, _listar(servico, tabela, self._forno(q.get("forno")), q))

            if caminho.startswith("/api/exportar/") and caminho.endswith(".csv"):
                tabela = caminho.rsplit("/", 1)[1][:-4]
                if tabela not in TABELAS_EXPORTAVEIS:
                    raise ErroApi(404, "Tabela inexistente")
                q.setdefault("limite", "500000")
                q.setdefault("dias", "31")
                linhas = _listar(servico, tabela, self._forno(q.get("forno")), q)
                corpo = _csv(linhas, servico)
                return self._enviar(200, corpo, "text/csv; charset=utf-8",
                                    {"Content-Disposition": f'attachment; filename="{tabela}.csv"'})

            raise ErroApi(404, "Rota não encontrada")

        def _rotear_post(self):
            caminho = urlparse(self.path).path.rstrip("/")
            if caminho != "/api/amostras":
                raise ErroApi(404, "Rota não encontrada")
            if cfg.token_api and self.headers.get("X-Token") != cfg.token_api:
                raise ErroApi(401, "Token inválido")
            tamanho = int(self.headers.get("Content-Length") or 0)
            if tamanho <= 0 or tamanho > TAMANHO_MAX_CORPO:
                raise ErroApi(400, "Corpo da requisição vazio ou grande demais (não envie a foto)")
            try:
                dados = json.loads(self.rfile.read(tamanho).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise ErroApi(400, "JSON inválido") from None
            if not isinstance(dados, dict):
                raise ErroApi(400, "JSON deve ser um objeto")
            forno = self._forno(dados.get("forno"), obrigatorio=True)
            if dados.get("umidade") in (None, ""):
                raise ErroApi(400, "Informe a umidade")
            coletada = ler_data(dados.get("data_hora"), cfg.fuso_padrao)
            res = servico.processar_amostra(
                forno, dados["umidade"], coletada, origem="app",
                tipo_farinha=_texto(dados.get("tipo_farinha")), peneira=_texto(dados.get("peneira")),
                responsavel=_texto(dados.get("responsavel")), registro_id=_texto(dados.get("registro_id")),
            )
            self._json(200 if res["duplicada"] else 201, res)

    return ThreadingHTTPServer((host, porta if porta is not None else cfg.porta), Manipulador)


def _texto(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s[:200] or None


def _padrao_json(o):
    if isinstance(o, float) and not math.isfinite(o):
        return None
    return str(o)


def _listar(servico: ServicoUmidade, tabela: str, forno: str | None, q: dict) -> list[dict]:
    coluna_tempo = {"amostras": "coletada_em", "sugestoes": "calculada_em", "leituras": "lido_em"}[tabela]
    try:
        limite = max(1, min(int(q.get("limite", "200")), 500000))
        horas = float(q["horas"]) if "horas" in q else float(q.get("dias", "7")) * 24
    except ValueError:
        raise ErroApi(400, "Parâmetro numérico inválido") from None
    desde = servico.relogio() - timedelta(hours=horas)
    sql = f"SELECT * FROM {tabela} WHERE {coluna_tempo} >= ?"
    params: list = [iso(desde)]
    if forno:
        sql += " AND forno = ?"
        params.append(forno)
    if tabela == "sugestoes" and q.get("origem"):
        sql += " AND origem = ?"
        params.append(q["origem"])
    sql += f" ORDER BY {coluna_tempo} DESC LIMIT ?"
    params.append(limite)
    linhas = servico.banco.consultar(sql, tuple(params))
    if tabela == "sugestoes":
        for linha in linhas:
            linha["avisos"] = json.loads(linha["avisos"] or "[]")
    return linhas


def _csv(linhas: list[dict], servico: ServicoUmidade) -> bytes:
    """CSV no formato do Excel brasileiro: separador ';', vírgula decimal, hora local."""
    saida = io.StringIO()
    if not linhas:
        return "﻿".encode("utf-8")
    campos = list(linhas[0].keys())
    w = csv.writer(saida, delimiter=";")
    w.writerow(campos)
    fuso = servico.cfg.fuso_padrao
    for linha in reversed(linhas):
        valores = []
        for c in campos:
            v = linha[c]
            if isinstance(v, list):
                v = " | ".join(v)
            elif c.endswith("_em") and isinstance(v, str):
                dt = de_iso(v)
                v = dt.astimezone(fuso).strftime("%d/%m/%Y %H:%M:%S") if dt else v
            elif isinstance(v, float):
                v = f"{v:.4f}".rstrip("0").rstrip(".").replace(".", ",")
            valores.append("" if v is None else v)
        w.writerow(valores)
    return ("﻿" + saida.getvalue()).encode("utf-8")
