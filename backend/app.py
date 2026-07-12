"""
SENTINEL-Q Flask Backend API
Provides endpoints for alert management, scoring, configuration, and live data ingestion
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import random
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from scoring_engine import ScoringEngine

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'sentinel_q.db')

WEAK_CIPHERS = ['TLS_RSA_WITH_AES_256_CBC_SHA', 'TLS_RSA_WITH_3DES_EDE_CBC_SHA']
MODERN_CIPHERS = ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                   'TLS_AES_128_GCM_SHA256', 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384']

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_scoring_engine():
    return ScoringEngine(DB_PATH)

def score_and_store(session_id, transaction_data, telemetry_data):
    conn = get_db_connection()

    now = datetime.now().isoformat()

    tx_id = f"tx_{session_id[-6:]}" if len(session_id) >= 6 else f"tx_{random.randint(100000,999999)}"
    conn.execute(
        '''INSERT OR IGNORE INTO transactions
           (transaction_id, session_id, customer_id, timestamp, amount,
            geo_location, device_id, payee_id, is_new_payee, velocity_1h, velocity_24h)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (tx_id, session_id, transaction_data.get('customer_id', f"cust_{random.randint(1000,9999)}"),
         now, transaction_data['amount'], transaction_data['geo_location'],
         transaction_data.get('device_id', f"device_{random.randint(1000,9999)}"),
         transaction_data.get('payee_id', f"payee_{random.randint(100,999)}"),
         transaction_data.get('is_new_payee', 0),
         transaction_data.get('velocity_1h', 0),
         transaction_data.get('velocity_24h', 0))
    )

    tel_id = f"tel_{session_id[-6:]}" if len(session_id) >= 6 else f"tel_{random.randint(100000,999999)}"
    conn.execute(
        '''INSERT OR IGNORE INTO telemetry
           (telemetry_id, session_id, customer_id, timestamp, auth_event_type,
            ip_address, ip_reputation_score, device_fingerprint_changed,
            geo_mismatch, tls_cipher_suite, data_sensitivity_class, failed_auth_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (tel_id, session_id, transaction_data.get('customer_id', f"cust_{random.randint(1000,9999)}"),
         now, telemetry_data.get('auth_event_type', 'login'),
         telemetry_data.get('ip_address', f"192.168.{random.randint(1,254)}.{random.randint(1,254)}"),
         telemetry_data.get('ip_reputation_score', 0.5),
         telemetry_data.get('device_fingerprint_changed', 0),
         telemetry_data.get('geo_mismatch', 0),
         telemetry_data.get('tls_cipher_suite', random.choice(MODERN_CIPHERS)),
         telemetry_data.get('data_sensitivity_class', 'transactional'),
         telemetry_data.get('failed_auth_count', 0))
    )

    conn.commit()
    conn.close()

    engine = get_scoring_engine()
    score_result = engine.score_session(session_id)

    if not score_result:
        return None

    conn = get_db_connection()
    score_id = f"score_{session_id[-6:]}_{random.randint(100,999)}"
    conn.execute(
        '''INSERT INTO scores
           (score_id, session_id, fraud_score, telemetry_score, quantum_posture_score,
            composite_score, risk_band, computed_at, config_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (score_id, session_id, score_result['fraud_score'],
         score_result['telemetry_score'], score_result['quantum_posture_score'],
         score_result['composite_score'], score_result['risk_band'],
         now, 'v1.0.0')
    )

    alert_id = None
    if score_result['risk_band'] in ['HIGH', 'CRITICAL']:
        cursor = conn.execute(
            '''INSERT INTO alerts (score_id, session_id, status, reviewed_at)
               VALUES (?, ?, 'open', ?)''',
            (score_id, session_id, now)
        )
        alert_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return {
        'session_id': session_id,
        'score_id': score_id,
        'fraud_score': round(score_result['fraud_score'], 4),
        'telemetry_score': round(score_result['telemetry_score'], 4),
        'quantum_posture_score': round(score_result['quantum_posture_score'], 4),
        'composite_score': round(score_result['composite_score'], 4),
        'risk_band': score_result['risk_band'],
        'alert_id': alert_id
    }

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'version': '1.0.0', 'timestamp': datetime.now().isoformat()})

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    conn = get_db_connection()

    risk_band = request.args.get('risk_band')
    status = request.args.get('status', 'open')
    limit = int(request.args.get('limit', 50))

    query = '''
        SELECT
            a.alert_id, a.session_id, a.status, a.verdict, a.analyst_note, a.reviewed_at,
            s.fraud_score, s.telemetry_score, s.quantum_posture_score, s.composite_score, s.risk_band,
            t.amount, t.geo_location, t.device_id, t.payee_id, t.is_new_payee, t.velocity_1h, t.velocity_24h,
            tel.ip_reputation_score, tel.device_fingerprint_changed, tel.geo_mismatch, tel.tls_cipher_suite
        FROM alerts a
        INNER JOIN scores s ON a.score_id = s.score_id
        INNER JOIN transactions t ON s.session_id = t.session_id
        INNER JOIN telemetry tel ON s.session_id = tel.session_id
        WHERE 1=1
    '''
    params = []

    if status:
        query += ' AND a.status = ?'
        params.append(status)

    if risk_band:
        query += ' AND s.risk_band = ?'
        params.append(risk_band)

    query += ' ORDER BY s.composite_score DESC LIMIT ?'
    params.append(limit)

    alerts = conn.execute(query, params).fetchall()
    conn.close()

    result = []
    for alert in alerts:
        note_data = {}
        if alert['analyst_note']:
            try:
                note_data = json.loads(alert['analyst_note'])
            except:
                pass

        result.append({
            'alert_id': alert['alert_id'],
            'session_id': alert['session_id'],
            'status': alert['status'],
            'verdict': alert['verdict'],
            'reviewed_at': alert['reviewed_at'],
            'fraud_score': alert['fraud_score'],
            'telemetry_score': alert['telemetry_score'],
            'quantum_posture_score': alert['quantum_posture_score'],
            'composite_score': alert['composite_score'],
            'risk_band': alert['risk_band'],
            'transaction': {
                'amount': alert['amount'],
                'geo_location': alert['geo_location'],
                'device_id': alert['device_id'],
                'payee_id': alert['payee_id'],
                'is_new_payee': alert['is_new_payee'],
                'velocity_1h': alert['velocity_1h'],
                'velocity_24h': alert['velocity_24h']
            },
            'telemetry': {
                'ip_reputation_score': alert['ip_reputation_score'],
                'device_fingerprint_changed': alert['device_fingerprint_changed'],
                'geo_mismatch': alert['geo_mismatch'],
                'tls_cipher_suite': alert['tls_cipher_suite']
            },
            'ml_prediction': note_data.get('ml_prediction'),
            'shap_features': note_data.get('shap_features', {})
        })

    return jsonify(result)

@app.route('/api/alerts/<alert_id>', methods=['GET'])
def get_alert_detail(alert_id):
    conn = get_db_connection()

    alert = conn.execute(
        '''SELECT a.*, s.fraud_score, s.telemetry_score, s.quantum_posture_score,
                  s.composite_score, s.risk_band, s.computed_at, s.config_version
           FROM alerts a
           INNER JOIN scores s ON a.score_id = s.score_id
           WHERE a.alert_id = ?''',
        (alert_id,)
    ).fetchone()

    if not alert:
        conn.close()
        return jsonify({'error': 'Alert not found'}), 404

    transaction = conn.execute(
        'SELECT * FROM transactions WHERE session_id = ?',
        (alert['session_id'],)
    ).fetchone()

    telemetry = conn.execute(
        'SELECT * FROM telemetry WHERE session_id = ?',
        (alert['session_id'],)
    ).fetchone()

    conn.close()

    note_data = {}
    if alert['analyst_note']:
        try:
            note_data = json.loads(alert['analyst_note'])
        except:
            pass

    result = {
        'alert': {
            'alert_id': alert['alert_id'],
            'session_id': alert['session_id'],
            'status': alert['status'],
            'verdict': alert['verdict'],
            'analyst_note': alert['analyst_note'],
            'created_at': alert['reviewed_at']
        },
        'scores': {
            'fraud_score': alert['fraud_score'],
            'telemetry_score': alert['telemetry_score'],
            'quantum_posture_score': alert['quantum_posture_score'],
            'composite_score': alert['composite_score'],
            'risk_band': alert['risk_band'],
            'computed_at': alert['computed_at'],
            'config_version': alert['config_version']
        },
        'transaction': dict(transaction) if transaction else None,
        'telemetry': dict(telemetry) if telemetry else None,
        'ml_prediction': note_data.get('ml_prediction'),
        'shap_features': note_data.get('shap_features', {})
    }

    return jsonify(result)

@app.route('/api/alerts/<alert_id>/verdict', methods=['POST'])
def update_alert_verdict(alert_id):
    data = request.json
    verdict = data.get('verdict')
    note = data.get('note', '')
    analyst_id = data.get('analyst_id', 'analyst_001')

    if verdict not in ['false_positive', 'escalated']:
        return jsonify({'error': 'Invalid verdict'}), 400

    conn = get_db_connection()
    conn.execute(
        '''UPDATE alerts
           SET verdict = ?, analyst_note = ?, analyst_id = ?, reviewed_at = ?, status = 'reviewed'
           WHERE alert_id = ?''',
        (verdict, note, analyst_id, datetime.now().isoformat(), alert_id)
    )
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'verdict': verdict})

@app.route('/api/crypto-posture/summary', methods=['GET'])
def get_crypto_posture_summary():
    conn = get_db_connection()

    cipher_stats = conn.execute(
        '''SELECT tls_cipher_suite, data_sensitivity_class, COUNT(*) as count
           FROM telemetry
           GROUP BY tls_cipher_suite, data_sensitivity_class'''
    ).fetchall()

    total = conn.execute('SELECT COUNT(*) as count FROM telemetry').fetchone()['count']

    conn.close()

    weak_count = 0
    modern_count = 0
    sensitive_weak_count = 0

    for stat in cipher_stats:
        cipher = stat['tls_cipher_suite']
        sensitivity = stat['data_sensitivity_class']
        count = stat['count']

        if cipher in WEAK_CIPHERS:
            weak_count += count
            if sensitivity in ['PII', 'financial_record']:
                sensitive_weak_count += count
        elif cipher in MODERN_CIPHERS:
            modern_count += count

    result = {
        'total_sessions': total,
        'classical_only_sessions': weak_count,
        'modern_cipher_sessions': modern_count,
        'sensitive_data_weak_cipher': sensitive_weak_count,
        'classical_only_percentage': (weak_count / total * 100) if total > 0 else 0,
        'modern_percentage': (modern_count / total * 100) if total > 0 else 0,
        'breakdown': [
            {'cipher_suite': stat['tls_cipher_suite'],
             'data_sensitivity': stat['data_sensitivity_class'],
             'count': stat['count']}
            for stat in cipher_stats
        ]
    }

    return jsonify(result)

@app.route('/api/config', methods=['GET'])
def get_config():
    conn = get_db_connection()
    config = conn.execute(
        'SELECT * FROM scoring_config ORDER BY created_at DESC LIMIT 1'
    ).fetchone()
    conn.close()

    if not config:
        return jsonify({'error': 'No configuration found'}), 404

    return jsonify(dict(config))

@app.route('/api/config', methods=['PUT'])
def update_config():
    data = request.json

    weights = [data.get('fraud_weight', 0), data.get('telemetry_weight', 0), data.get('quantum_weight', 0)]
    if abs(sum(weights) - 1.0) > 0.01:
        return jsonify({'error': 'Weights must sum to 1.0'}), 400

    conn = get_db_connection()

    config_version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    conn.execute(
        '''INSERT INTO scoring_config
           (config_version, fraud_weight, telemetry_weight, quantum_weight,
            low_threshold, medium_threshold, high_threshold, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (config_version,
         data.get('fraud_weight', 0.4),
         data.get('telemetry_weight', 0.4),
         data.get('quantum_weight', 0.2),
         data.get('low_threshold', 0.3),
         data.get('medium_threshold', 0.6),
         data.get('high_threshold', 0.8),
         datetime.now().isoformat(),
         data.get('created_by', 'admin_001'))
    )

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'config_version': config_version})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()

    total_sessions = conn.execute('SELECT COUNT(*) as count FROM transactions').fetchone()['count']
    total_alerts = conn.execute('SELECT COUNT(*) as count FROM alerts').fetchone()['count']
    open_alerts = conn.execute("SELECT COUNT(*) as count FROM alerts WHERE status = 'open'").fetchone()['count']

    risk_distribution = conn.execute(
        '''SELECT risk_band, COUNT(*) as count
           FROM scores
           GROUP BY risk_band'''
    ).fetchall()

    conn.close()

    result = {
        'total_sessions': total_sessions,
        'total_alerts': total_alerts,
        'open_alerts': open_alerts,
        'risk_distribution': {row['risk_band']: row['count'] for row in risk_distribution}
    }

    return jsonify(result)

@app.route('/api/simulate', methods=['POST'])
def simulate_transaction():
    """Auto-generate a random transaction and score it through the engine"""
    session_id = f"sess_{random.randint(100000, 999999)}"

    transaction_data = {
        'customer_id': f"cust_{random.randint(1000, 9999)}",
        'amount': random.randint(500, 500000),
        'geo_location': random.choice(['US-East', 'US-West', 'EU-West', 'AP-South', 'SA-East']),
        'device_id': f"device_{random.randint(1000, 9999)}",
        'payee_id': f"payee_{random.randint(100, 999)}",
        'is_new_payee': random.choice([0, 0, 0, 1]),
        'velocity_1h': random.randint(0, 15),
        'velocity_24h': random.randint(0, 60),
    }

    telemetry_data = {
        'auth_event_type': random.choice(['login', 'password_reset', 'mfa_challenge']),
        'ip_address': f"{random.choice([192,10,172,203])}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
        'ip_reputation_score': round(random.uniform(0.1, 1.0), 2),
        'device_fingerprint_changed': random.choice([0, 0, 1]),
        'geo_mismatch': random.choice([0, 0, 0, 1]),
        'tls_cipher_suite': random.choice(MODERN_CIPHERS + WEAK_CIPHERS),
        'data_sensitivity_class': random.choice(['financial_record', 'PII', 'transactional']),
        'failed_auth_count': random.randint(0, 8),
    }

    result = score_and_store(session_id, transaction_data, telemetry_data)

    return jsonify({
        'success': True,
        'session_id': session_id,
        'amount': transaction_data['amount'],
        **result
    })

@app.route('/api/ingest', methods=['POST'])
def ingest_transaction():
    """Accept analyst-submitted transaction + telemetry, score it, return result"""
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    transaction = data.get('transaction', {})
    telemetry = data.get('telemetry', {})
    session_id = data.get('session_id', f"sess_{random.randint(100000, 999999)}")

    required_tx = ['amount', 'geo_location']
    for field in required_tx:
        if field not in transaction:
            return jsonify({'error': f'Missing transaction field: {field}'}), 400

    result = score_and_store(session_id, transaction, telemetry)

    if not result:
        return jsonify({'error': 'Scoring failed'}), 500

    return jsonify({
        'success': True,
        'session_id': session_id,
        'input': data,
        **result
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
