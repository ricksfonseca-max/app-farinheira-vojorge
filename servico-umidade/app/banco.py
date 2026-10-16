"""Armazenamento em SQLite (um arquivo, sem servidor de banco).

Datas sempre gravadas em UTC, formato ISO, para que a comparação de texto
funcione como comparação de tempo.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone

ESQUEMA = """
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS leituras (
    id            INTEGER PRIMARY KEY,
    forno         TEXT NOT NULL,
    lido_em       TEXT NOT NULL,
    velocidade_hz REAL,
    pressao_bar   REAL,
    tsat_c        REAL,
    rodando       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_leituras_forno_tempo ON leituras (forno, lido_em);

CREATE TABLE IF NOT EXISTS amostras (
    id                 INTEGER PRIMARY KEY,
    forno              TEXT NOT NULL,
    coletada_em        TEXT NOT NULL,
    umidade            REAL NOT NULL,
    origem             TEXT NOT NULL,          -- app | sync
    chave              TEXT NOT NULL,          -- evita duplicar o mesmo apontamento
    tipo_farinha       TEXT,
    peneira            TEXT,
    responsavel        TEXT,
    registro_id        TEXT,
    velocidade_hz      REAL,                   -- no momento da coleta
    pressao_bar        REAL,
    tsat_c             REAL,
    v_media_janela     REAL,                   -- enquanto esta massa estava no forno
    fator_media_janela REAL,
    v_desvio_janela    REAL,
    base_media_janela  REAL,                   -- rotação / fator_vapor (o que o modelo usa)
    base_desvio_janela REAL,
    n_leituras_janela  INTEGER,
    janela_estavel     INTEGER,
    recebida_em        TEXT NOT NULL,
    UNIQUE (forno, chave)
);
CREATE INDEX IF NOT EXISTS ix_amostras_forno_tempo ON amostras (forno, coletada_em);

CREATE TABLE IF NOT EXISTS sugestoes (
    id                     INTEGER PRIMARY KEY,
    forno                  TEXT NOT NULL,
    calculada_em           TEXT NOT NULL,
    origem                 TEXT NOT NULL,      -- amostra | vapor
    acao                   TEXT NOT NULL,
    motivo                 TEXT NOT NULL,
    velocidade_atual_hz    REAL,
    velocidade_sugerida_hz REAL,
    pressao_bar            REAL,
    tsat_c                 REAL,
    fator_vapor            REAL,
    umidade                REAL,
    umidade_alvo           REAL,
    erro                   REAL,
    delta_hz               REAL,
    ganho_k                REAL,
    amostra_id             INTEGER REFERENCES amostras (id),
    avisos                 TEXT,
    aplicada               INTEGER,            -- 1 sim, 0 não, -1 não se aplica, NULL pendente
    velocidade_apos_hz     REAL,
    verificada_em          TEXT
);
CREATE INDEX IF NOT EXISTS ix_sugestoes_forno_tempo ON sugestoes (forno, calculada_em);

CREATE TABLE IF NOT EXISTS setpoints (          -- histórico: a linha mais recente vale
    id            INTEGER PRIMARY KEY,
    forno         TEXT NOT NULL,
    umidade_alvo  REAL NOT NULL,
    alterado_por  TEXT,
    motivo        TEXT,
    alterado_em   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_setpoints_forno_tempo ON setpoints (forno, alterado_em);

CREATE TABLE IF NOT EXISTS modos (              -- histórico do modo da planta
    id            INTEGER PRIMARY KEY,
    modo          TEXT NOT NULL,                -- linha_base | conselheiro
    alterado_por  TEXT,
    motivo        TEXT,
    alterado_em   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estado_forno (
    forno                        TEXT PRIMARY KEY,
    base_alvo_hz                 REAL,
    fator_ref                    REAL,
    definido_em                  TEXT,
    ultima_amostra_em            TEXT,
    ultima_mudanca_velocidade_em TEXT,
    velocidade_referencia_hz     REAL
);
"""


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


class Banco:
    def __init__(self, caminho: str):
        self._con = sqlite3.connect(caminho, check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        self._trava = threading.RLock()
        with self._trava:
            self._con.executescript(ESQUEMA)
            self._con.commit()
            self._migrar()

    # Colunas acrescentadas depois da primeira versão (bancos antigos ganham na hora).
    _MIGRACOES = (
        ("leituras", "temp_saida_c", "REAL"),
        ("amostras", "temp_saida_c", "REAL"),
        ("amostras", "umidade_alvo", "REAL"),
        ("amostras", "modo", "TEXT"),
        ("sugestoes", "modo", "TEXT"),
    )

    def _migrar(self) -> None:
        for tabela, coluna, tipo in self._MIGRACOES:
            existentes = {r[1] for r in self._con.execute(f"PRAGMA table_info({tabela})")}
            if coluna not in existentes:
                self._con.execute(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {tipo}")
        self._con.commit()

    def executar(self, sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
        with self._trava:
            cur = self._con.execute(sql, params)
            self._con.commit()
            return cur

    def consultar(self, sql: str, params: tuple | dict = ()) -> list[dict]:
        with self._trava:
            return [dict(r) for r in self._con.execute(sql, params).fetchall()]

    def um(self, sql: str, params: tuple | dict = ()) -> dict | None:
        linhas = self.consultar(sql, params)
        return linhas[0] if linhas else None

    def inserir(self, tabela: str, dados: dict) -> int:
        colunas = ", ".join(dados)
        marcas = ", ".join(f":{c}" for c in dados)
        with self._trava:
            cur = self._con.execute(f"INSERT INTO {tabela} ({colunas}) VALUES ({marcas})", dados)
            self._con.commit()
            return int(cur.lastrowid)

    def fechar(self) -> None:
        with self._trava:
            self._con.close()


def json_avisos(avisos: list[str]) -> str:
    return json.dumps(avisos, ensure_ascii=False)
