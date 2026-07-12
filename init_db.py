"""
SENTINEL-Q Database Initialization
Creates all tables and seeds default configuration
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'sentinel_q.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        amount REAL NOT NULL,
        geo_location TEXT NOT NULL,
        device_id TEXT NOT NULL,
        payee_id TEXT NOT NULL,
        is_new_payee INTEGER NOT NULL DEFAULT 0,
        velocity_1h INTEGER NOT NULL DEFAULT 0,
        velocity_24h INTEGER NOT NULL DEFAULT 0
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS telemetry (
        telemetry_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        auth_event_type TEXT NOT NULL DEFAULT 'login',
        ip_address TEXT NOT NULL,
        ip_reputation_score REAL NOT NULL DEFAULT 0.5,
        device_fingerprint_changed INTEGER NOT NULL DEFAULT 0,
        geo_mismatch INTEGER NOT NULL DEFAULT 0,
        tls_cipher_suite TEXT NOT NULL,
        data_sensitivity_class TEXT NOT NULL DEFAULT 'transactional',
        failed_auth_count INTEGER NOT NULL DEFAULT 0
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS scoring_config (
        config_version TEXT PRIMARY KEY,
        fraud_weight REAL NOT NULL DEFAULT 0.4,
        telemetry_weight REAL NOT NULL DEFAULT 0.4,
        quantum_weight REAL NOT NULL DEFAULT 0.2,
        low_threshold REAL NOT NULL DEFAULT 0.3,
        medium_threshold REAL NOT NULL DEFAULT 0.6,
        high_threshold REAL NOT NULL DEFAULT 0.8,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL DEFAULT 'system'
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS scores (
        score_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        fraud_score REAL NOT NULL,
        telemetry_score REAL NOT NULL,
        quantum_posture_score REAL NOT NULL,
        composite_score REAL NOT NULL,
        risk_band TEXT NOT NULL,
        computed_at TEXT NOT NULL,
        config_version TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS alerts (
        alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
        score_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        verdict TEXT,
        analyst_note TEXT,
        analyst_id TEXT,
        reviewed_at TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'analyst',
        created_at TEXT NOT NULL
    )''')

    existing_config = c.execute('SELECT COUNT(*) FROM scoring_config').fetchone()[0]
    if existing_config == 0:
        c.execute(
            '''INSERT INTO scoring_config
               (config_version, fraud_weight, telemetry_weight, quantum_weight,
                low_threshold, medium_threshold, high_threshold, created_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            ('v1.0.0', 0.4, 0.4, 0.2, 0.3, 0.6, 0.8, datetime.now().isoformat(), 'system')
        )

    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

if __name__ == '__main__':
    init_db()
