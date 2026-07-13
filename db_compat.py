"""
SQLite compatibility wrapper
Converts PostgreSQL-style %s placeholders to SQLite ? placeholders
"""
import re
import sqlite3 as _sqlite3


class CompatCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, params=None):
        if params is not None:
            query = re.sub(r'%s', '?', query)
        if params is not None:
            self._cursor.execute(query, params)
        else:
            self._cursor.execute(query)
        return self

    def executemany(self, query, params_seq):
        query = re.sub(r'%s', '?', query)
        self._cursor.executemany(query, params_seq)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def __iter__(self):
        return iter(self._cursor)

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class CompatConnection:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, query, params=None):
        if params is not None:
            query = re.sub(r'%s', '?', query)
            return CompatCursor(self._conn.execute(query, params))
        return CompatCursor(self._conn.execute(query))

    def cursor(self):
        return CompatCursor(self._conn.cursor())

    def commit(self):
        return self._conn.commit()

    def close(self):
        return self._conn.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)


def connect(db_path):
    raw = _sqlite3.connect(db_path)
    raw.row_factory = _sqlite3.Row
    return CompatConnection(raw)
