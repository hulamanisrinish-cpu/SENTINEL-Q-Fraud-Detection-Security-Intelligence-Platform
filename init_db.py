"""
SENTINEL-Q Database Initialization
Creates all tables and seeds default configuration
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
if DATABASE_URL and 'sslmode' not in DATABASE_URL:
    sep = '&' if '?' in DATABASE_URL else '?'
    DATABASE_URL = f'{DATABASE_URL}{sep}sslmode=require'


def get_connection():
    if DATABASE_URL:
        try:
            import db_compat
            return db_compat.wrap_pg(psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor))
        except Exception:
            pass
    import db_compat
    db_path = os.path.join(os.path.dirname(__file__), 'sentinel_q.db')
    return db_compat.connect(db_path)


def init_db():
    conn = get_connection()
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
        alert_id SERIAL PRIMARY KEY,
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
        password_hash TEXT,
        created_at TEXT NOT NULL
    )''')

    c.execute("SELECT COUNT(*) as count FROM scoring_config")
    result = c.fetchone()
    existing_config = result['count'] if isinstance(result, dict) else result[0]

    if existing_config == 0:
        c.execute(
            '''INSERT INTO scoring_config
               (config_version, fraud_weight, telemetry_weight, quantum_weight,
                low_threshold, medium_threshold, high_threshold, created_at, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            ('v1.0.0', 0.4, 0.4, 0.2, 0.3, 0.6, 0.8, datetime.now().isoformat(), 'system')
        )

    conn.commit()
    conn.close()
    print(f"Database initialized")


if __name__ == '__main__':
    init_db()
