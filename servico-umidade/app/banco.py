"""Armazenamento: SQLite (um arquivo, usado nos testes) ou MySQL (produção).

O esquema é descrito uma vez só (TABELAS) e gerado para cada dialeto. Colunas que
faltarem num banco antigo são acrescentadas na inicialização (migração automática).

Datas são gravadas em UTC no formato ISO (texto), para que a comparação de texto
funcione como comparação de tempo nos dois bancos; as leituras guardam também o
instante em segundos (lido_ts) para agregar os gráficos por intervalo.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import unquote, urlparse

# (coluna, tipo genérico, restrição)
#   tipos: id | curto (texto até 200) | texto (longo) | data (ISO UTC) | real | inteiro
TABELAS: dict[str, dict] = {
    "leituras": {
        "colunas": [
            ("id", "id", ""), ("forno", "curto", "NOT NULL"), ("lido_em", "data", "NOT NULL"),
            ("lido_ts", "inteiro", ""), ("velocidade_hz", "real", ""), ("alimentacao_hz", "real", ""),
            ("pressao_bar", "real", ""), ("tsat_c", "real", ""), ("temp_saida_c", "real", ""),
            ("rodando", "inteiro", "NOT NULL"),
        ],
        "indices": [("ix_leituras_forno_tempo", "forno, lido_em"), ("ix_leituras_forno_ts", "forno, lido_ts")],
    },
    "amostras": {
        "colunas": [
            ("id", "id", ""), ("forno", "curto", "NOT NULL"), ("coletada_em", "data", "NOT NULL"),
            ("umidade", "real", "NOT NULL"), ("origem", "curto", "NOT NULL"), ("chave", "curto", "NOT NULL"),
            ("tipo_farinha", "curto", ""), ("peneira", "curto", ""), ("responsavel", "curto", ""),
            ("registro_id", "curto", ""), ("velocidade_hz", "real", ""), ("alimentacao_hz", "real", ""),
            ("pressao_bar", "real", ""), ("tsat_c", "real", ""), ("temp_saida_c", "real", ""),
            ("umidade_alvo", "real", ""), ("modo", "curto", ""),
            ("v_media_janela", "real", ""), ("fator_media_janela", "real", ""), ("v_desvio_janela", "real", ""),
            ("base_media_janela", "real", ""), ("base_desvio_janela", "real", ""),
            ("n_leituras_janela", "inteiro", ""), ("janela_estavel", "inteiro", ""),
            ("recebida_em", "data", "NOT NULL"),
        ],
        "indices": [("ix_amostras_forno_tempo", "forno, coletada_em")],
        "unicos": [("uq_amostras_forno_chave", "forno, chave")],
    },
    "sugestoes": {
        "colunas": [
            ("id", "id", ""), ("forno", "curto", "NOT NULL"), ("calculada_em", "data", "NOT NULL"),
            ("origem", "curto", "NOT NULL"), ("acao", "curto", "NOT NULL"), ("motivo", "texto", "NOT NULL"),
            ("variavel", "curto", ""), ("modo", "curto", ""),
            ("velocidade_atual_hz", "real", ""), ("velocidade_sugerida_hz", "real", ""),
            ("pressao_bar", "real", ""), ("tsat_c", "real", ""), ("fator_vapor", "real", ""),
            ("umidade", "real", ""), ("umidade_alvo", "real", ""), ("erro", "real", ""),
            ("delta_hz", "real", ""), ("ganho_k", "real", ""), ("amostra_id", "inteiro", ""),
            ("avisos", "texto", ""), ("aplicada", "inteiro", ""), ("velocidade_apos_hz", "real", ""),
            ("verificada_em", "data", ""),
        ],
        "indices": [("ix_sugestoes_forno_tempo", "forno, calculada_em")],
    },
    "setpoints": {
        "colunas": [
            ("id", "id", ""), ("forno", "curto", "NOT NULL"), ("umidade_alvo", "real", "NOT NULL"),
            ("alterado_por", "curto", ""), ("motivo", "texto", ""), ("alterado_em", "data", "NOT NULL"),
        ],
        "indices": [("ix_setpoints_forno_tempo", "forno, alterado_em")],
    },
    "modos": {
        "colunas": [
            ("id", "id", ""), ("modo", "curto", "NOT NULL"), ("alterado_por", "curto", ""),
            ("motivo", "texto", ""), ("alterado_em", "data", "NOT NULL"),
        ],
    },
    "estado_forno": {
        "colunas": [
            ("forno", "curto", "PRIMARY KEY"), ("base_alvo_hz", "real", ""), ("fator_ref", "real", ""),
            ("definido_em", "data", ""), ("ultima_amostra_em", "data", ""),
            ("ultima_mudanca_velocidade_em", "data", ""), ("velocidade_referencia_hz", "real", ""),
        ],
    },
}

_TIPOS = {
    "sqlite": {"id": "INTEGER PRIMARY KEY", "curto": "TEXT", "texto": "TEXT", "data": "TEXT",
               "real": "REAL", "inteiro": "INTEGER"},
    "mysql": {"id": "BIGINT AUTO_INCREMENT PRIMARY KEY", "curto": "VARCHAR(200)", "texto": "TEXT",
              "data": "VARCHAR(32)", "real": "DOUBLE", "inteiro": "BIGINT"},
}


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        raise ValueError("datetime sem fuso horário")
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def de_iso(texto: str | None) -> datetime | None:
    if not texto:
        return None
    return datetime.fromisoformat(texto)


def _ddl(dialeto: str, tabela: str, spec: dict) -> list[str]:
    tipos = _TIPOS[dialeto]
    partes = [f"{c} {tipos[t]} {r}".strip() for c, t, r in spec["colunas"]]
    comandos = []
    if dialeto == "mysql":
        partes += [f"INDEX {n} ({cols})" for n, cols in spec.get("indices", [])]
        partes += [f"UNIQUE KEY {n} ({cols})" for n, cols in spec.get("unicos", [])]
        comandos.append(f"CREATE TABLE IF NOT EXISTS {tabela} (\n  " + ",\n  ".join(partes) +
                        "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4")
    else:
        partes += [f"UNIQUE ({cols})" for _, cols in spec.get("unicos", [])]
        comandos.append(f"CREATE TABLE IF NOT EXISTS {tabela} (\n  " + ",\n  ".join(partes) + "\n)")
        comandos += [f"CREATE INDEX IF NOT EXISTS {n} ON {tabela} ({cols})" for n, cols in spec.get("indices", [])]
    return comandos


class Banco:
    """Banco com a mesma interface para SQLite e MySQL.

    destino: caminho do arquivo SQLite (ou ":memory:") ou
             mysql://usuario:senha@host:3306/banco
    """

    def __init__(self, destino: str):
        self._trava = threading.RLock()
        self.destino_seguro = destino
        if destino.startswith("mysql://"):
            self.dialeto = "mysql"
            self._abrir_mysql(destino)
        else:
            self.dialeto = "sqlite"
            self._con = sqlite3.connect(destino, check_same_thread=False)
            self._con.row_factory = sqlite3.Row
            self._con.execute("PRAGMA journal_mode = WAL")
        with self._trava:
            for tabela, spec in TABELAS.items():
                for cmd in _ddl(self.dialeto, tabela, spec):
                    self._executar_bruto(cmd)
            self._migrar()

    # ------------------------------------------------------------ conexão
    def _abrir_mysql(self, url: str) -> None:
        import pymysql  # dependência só da produção (ver requirements.txt)

        u = urlparse(url)
        self._mysql_args = dict(
            host=u.hostname or "localhost", port=u.port or 3306, user=unquote(u.username or ""),
            password=unquote(u.password or ""), database=(u.path or "/").lstrip("/"),
            charset="utf8mb4", autocommit=True, connect_timeout=10,
            cursorclass=pymysql.cursors.DictCursor,
        )
        self.destino_seguro = f"mysql://{u.username}:***@{u.hostname}:{u.port or 3306}{u.path}"
        self._con = pymysql.connect(**self._mysql_args)

    def _cursor(self):
        if self.dialeto == "mysql":
            self._con.ping(reconnect=True)  # reabre se o MySQL reiniciou ou a conexão caiu
            return self._con.cursor()
        return self._con.cursor()

    def _sql(self, sql: str) -> str:
        return sql.replace("?", "%s") if self.dialeto == "mysql" else sql

    def _executar_bruto(self, sql: str, params=()):
        cur = self._cursor()
        cur.execute(sql, params) if params else cur.execute(sql)
        if self.dialeto == "sqlite":
            self._con.commit()
        return cur

    # ------------------------------------------------------------ migração
    def colunas(self, tabela: str) -> set[str]:
        if self.dialeto == "mysql":
            linhas = self.consultar(
                "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                (tabela,))
            return {r["c"] for r in linhas}
        return {r[1] for r in self._con.execute(f"PRAGMA table_info({tabela})")}

    def _migrar(self) -> None:
        tipos = _TIPOS[self.dialeto]
        for tabela, spec in TABELAS.items():
            existentes = self.colunas(tabela)
            for coluna, tipo, restricao in spec["colunas"]:
                if coluna not in existentes and tipo != "id" and "NOT NULL" not in restricao:
                    self._executar_bruto(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {tipos[tipo]}")
        if self.dialeto == "sqlite":  # leituras antigas, de antes da coluna lido_ts
            self._executar_bruto(
                "UPDATE leituras SET lido_ts = CAST(strftime('%s', lido_em) AS INTEGER) WHERE lido_ts IS NULL")

    # ------------------------------------------------------------ operações
    def executar(self, sql: str, params: tuple = ()):
        with self._trava:
            return self._executar_bruto(self._sql(sql), params)

    def consultar(self, sql: str, params: tuple = ()) -> list[dict]:
        with self._trava:
            cur = self._cursor()
            cur.execute(self._sql(sql), params)
            linhas = cur.fetchall()
        if self.dialeto == "sqlite":
            return [dict(r) for r in linhas]
        return [{k: float(v) if isinstance(v, Decimal) else v for k, v in r.items()} for r in linhas]

    def um(self, sql: str, params: tuple = ()) -> dict | None:
        linhas = self.consultar(sql, params)
        return linhas[0] if linhas else None

    def inserir(self, tabela: str, dados: dict) -> int:
        colunas = ", ".join(dados)
        marcas = ", ".join((f"%({c})s" if self.dialeto == "mysql" else f":{c}") for c in dados)
        with self._trava:
            cur = self._executar_bruto(f"INSERT INTO {tabela} ({colunas}) VALUES ({marcas})", dados)
            return int(cur.lastrowid)

    def upsert(self, tabela: str, dados: dict, chave: str) -> None:
        """Insere ou atualiza pela chave primária."""
        colunas = list(dados)
        if self.dialeto == "mysql":
            marcas = ", ".join(f"%({c})s" for c in colunas)
            atualiza = ", ".join(f"{c} = VALUES({c})" for c in colunas if c != chave)
            sql = f"INSERT INTO {tabela} ({', '.join(colunas)}) VALUES ({marcas}) ON DUPLICATE KEY UPDATE {atualiza}"
        else:
            marcas = ", ".join(f":{c}" for c in colunas)
            atualiza = ", ".join(f"{c} = excluded.{c}" for c in colunas if c != chave)
            sql = f"INSERT INTO {tabela} ({', '.join(colunas)}) VALUES ({marcas}) ON CONFLICT ({chave}) DO UPDATE SET {atualiza}"
        with self._trava:
            self._executar_bruto(sql, dados)

    def bloco_tempo(self, coluna_ts: str, passo_s: int) -> str:
        """Expressão SQL que agrupa um instante (segundos) em blocos de passo_s."""
        passo = int(passo_s)
        if self.dialeto == "mysql":
            return f"({coluna_ts} DIV {passo})"
        return f"CAST({coluna_ts} / {passo} AS INTEGER)"

    def apagar_tudo(self) -> None:
        """Só para testes: remove as tabelas do serviço."""
        with self._trava:
            for tabela in TABELAS:
                self._executar_bruto(f"DROP TABLE IF EXISTS {tabela}")

    def fechar(self) -> None:
        with self._trava:
            self._con.close()


def json_avisos(avisos: list[str]) -> str:
    return json.dumps(avisos, ensure_ascii=False)
