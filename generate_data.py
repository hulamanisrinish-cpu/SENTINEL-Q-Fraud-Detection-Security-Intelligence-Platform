"""
SENTINEL-Q Sample Data Generator
Seeds the database with realistic cybersecurity + transaction telemetry
"""
import os
import random
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')

GEO_LOCATIONS = ['US-East', 'US-West', 'EU-West', 'EU-Central', 'AP-South', 'AP-East', 'SA-East']
WEAK_CIPHERS = ['TLS_RSA_WITH_AES_256_CBC_SHA', 'TLS_RSA_WITH_3DES_EDE_CBC_SHA']
MODERN_CIPHERS = ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256', 'TLS_AES_128_GCM_SHA256', 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384']
SENSITIVITY_CLASSES = ['financial_record', 'PII', 'transactional', 'session_token', 'public']
AUTH_EVENTS = ['login', 'login', 'login', 'password_reset', 'mfa_challenge', 'session_extend']
IP_PREFIXES = ['192.168', '10.0', '172.16', '203.0.113', '198.51.100', '8.8']


def random_ip():
    return f"{random.choice(IP_PREFIXES)}.{random.randint(1,254)}.{random.randint(1,254)}"


def generate_seed_data(n_sessions=200, n_high_risk=30):
    from init_db import init_db
    init_db()

    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    else:
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), 'sentinel_q.db')
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

    c = conn.cursor()

    c.execute('SELECT COUNT(*) as count FROM transactions')
    result = c.fetchone()
    existing = result['count'] if isinstance(result, dict) else result[0]
    if existing >= n_sessions:
        print(f"Database already has {existing} sessions. Skipping generation.")
        conn.close()
        return

    now = datetime.now()
    base_time = now - timedelta(hours=24)

    for i in range(n_sessions):
        session_id = f"sess_{random.randint(100000, 999999)}"
        customer_id = f"cust_{random.randint(1000, 9999)}"
        timestamp = (base_time + timedelta(minutes=random.randint(0, 1440))).isoformat()

        is_high_risk_scenario = i < n_high_risk

        if is_high_risk_scenario:
            amount = random.randint(50000, 500000)
            is_new_payee = random.choice([1, 1, 0])
            velocity_1h = random.randint(5, 20)
            velocity_24h = random.randint(20, 80)
            ip_reputation = random.uniform(0.1, 0.4)
            device_fingerprint_changed = random.choice([1, 1, 1, 0])
            geo_mismatch = random.choice([1, 1, 0])
            cipher_suite = random.choice(WEAK_CIPHERS)
            data_sensitivity = random.choice(['financial_record', 'PII'])
            failed_auth = random.randint(3, 10)
            auth_event = random.choice(['password_reset', 'mfa_challenge', 'login'])
        else:
            amount = random.randint(100, 25000)
            is_new_payee = random.choice([0, 0, 0, 1])
            velocity_1h = random.randint(0, 3)
            velocity_24h = random.randint(0, 10)
            ip_reputation = random.uniform(0.6, 1.0)
            device_fingerprint_changed = random.choice([0, 0, 0, 1])
            geo_mismatch = random.choice([0, 0, 0, 1])
            cipher_suite = random.choice(MODERN_CIPHERS)
            data_sensitivity = random.choice(SENSITIVITY_CLASSES)
            failed_auth = random.randint(0, 2)
            auth_event = random.choice(AUTH_EVENTS)

        geo = random.choice(GEO_LOCATIONS)
        device_id = f"device_{random.randint(1000, 9999)}"
        payee_id = f"payee_{random.randint(100, 999)}"
        tx_id = f"tx_{session_id[-6:]}"

        c.execute(
            '''INSERT INTO transactions
               (transaction_id, session_id, customer_id, timestamp, amount,
                geo_location, device_id, payee_id, is_new_payee, velocity_1h, velocity_24h)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (transaction_id) DO NOTHING''',
            (tx_id, session_id, customer_id, timestamp, amount,
             geo, device_id, payee_id, is_new_payee, velocity_1h, velocity_24h)
        )

        tel_id = f"tel_{session_id[-6:]}"
        c.execute(
            '''INSERT INTO telemetry
               (telemetry_id, session_id, customer_id, timestamp, auth_event_type,
                ip_address, ip_reputation_score, device_fingerprint_changed,
                geo_mismatch, tls_cipher_suite, data_sensitivity_class, failed_auth_count)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (telemetry_id) DO NOTHING''',
            (tel_id, session_id, customer_id, timestamp, auth_event,
             random_ip(), ip_reputation, device_fingerprint_changed,
             geo_mismatch, cipher_suite, data_sensitivity, failed_auth)
        )

    conn.commit()

    from scoring_engine import ScoringEngine
    engine = ScoringEngine()
    engine.score_all_sessions()

    print(f"\nGenerated {n_sessions} sessions ({n_high_risk} high-risk scenarios)")
    conn.close()


if __name__ == '__main__':
    generate_seed_data()
