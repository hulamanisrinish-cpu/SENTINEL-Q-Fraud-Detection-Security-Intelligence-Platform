"""
SENTINEL-Q Flask Backend API
Provides endpoints for alert management, scoring, configuration, and live data ingestion
"""
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
import json
import logging
import random
import re
import secrets
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'sentinel_q.db')

WEAK_CIPHERS = ['TLS_RSA_WITH_AES_256_CBC_SHA', 'TLS_RSA_WITH_3DES_EDE_CBC_SHA']
MODERN_CIPHERS = ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                   'TLS_AES_128_GCM_SHA256', 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384']

VALID_RISK_BANDS = {'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'}
VALID_STATUSES = {'open', 'reviewed'}
VALID_VERDICTS = {'false_positive', 'escalated'}
VALID_GEO_LOCATIONS = {'US-East', 'US-West', 'EU-West', 'EU-Central', 'AP-South', 'AP-East', 'SA-East'}
VALID_AUTH_EVENTS = {'login', 'password_reset', 'mfa_challenge', 'session_extend'}
VALID_SENSITIVITY_CLASSES = {'financial_record', 'PII', 'transactional', 'session_token', 'public'}
VALID_CIPHERS = set(MODERN_CIPHERS + WEAK_CIPHERS)
SESSION_ID_RE = re.compile(r'^sess_[a-zA-Z0-9]{1,32}$')
IP_RE = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from scoring_engine import ScoringEngine

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))
app.config.update(
    SESSION_COOKIE_SECURE=os.environ.get('FLASK_ENV', 'production') == 'production',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)
CORS(app, supports_credentials=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('sentinel-q')

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per minute"],
    storage_uri="memory://",
)


@app.errorhandler(400)
def bad_request(e):
    return jsonify({'error': 'Bad request'}), 400


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found'}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405


@app.errorhandler(429)
def rate_limited(e):
    return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429


@app.errorhandler(500)
def internal_error(e):
    logger.error('Internal server error: %s', e)
    return jsonify({'error': 'Internal server error'}), 500

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_scoring_engine():
    return ScoringEngine(DB_PATH)

def score_and_store(session_id, transaction_data, telemetry_data):
    try:
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
    except Exception as e:
        logger.error('score_and_store failed for session %s: %s', session_id, e)
        try:
            conn.close()
        except Exception:
            pass
        return None

@app.route('/health', methods=['GET'])
@limiter.exempt
def health():
    return jsonify({'status': 'ok', 'version': '1.0.0', 'timestamp': datetime.now().isoformat()})

@app.route('/api/alerts', methods=['GET'])
@limiter.limit("100 per minute")
def get_alerts():
    conn = get_db_connection()

    risk_band = request.args.get('risk_band')
    status = request.args.get('status', 'open')
    limit = request.args.get('limit', 50)

    if risk_band and risk_band not in VALID_RISK_BANDS:
        conn.close()
        return jsonify({'error': f'Invalid risk_band. Must be one of: {sorted(VALID_RISK_BANDS)}'}), 400

    if status and status not in VALID_STATUSES:
        conn.close()
        return jsonify({'error': f'Invalid status. Must be one of: {sorted(VALID_STATUSES)}'}), 400

    try:
        limit = int(limit)
        if limit < 1 or limit > 500:
            conn.close()
            return jsonify({'error': 'limit must be between 1 and 500'}), 400
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'error': 'limit must be a valid integer'}), 400

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
            except (json.JSONDecodeError, TypeError):
                logger.warning('Failed to parse analyst_note for alert %s', alert['alert_id'])

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
@limiter.limit("100 per minute")
def get_alert_detail(alert_id):
    if not alert_id or not alert_id.isdigit():
        return jsonify({'error': 'alert_id must be a positive integer'}), 400

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
        except (json.JSONDecodeError, TypeError):
            logger.warning('Failed to parse analyst_note for alert %s', alert_id)

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
@limiter.limit("20 per minute")
def update_alert_verdict(alert_id):
    if not alert_id or not alert_id.isdigit():
        return jsonify({'error': 'alert_id must be a positive integer'}), 400

    data = request.json
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    verdict = data.get('verdict')
    note = data.get('note', '')
    analyst_id = data.get('analyst_id', 'analyst_001')

    if verdict not in VALID_VERDICTS:
        return jsonify({'error': f'Invalid verdict. Must be one of: {sorted(VALID_VERDICTS)}'}), 400

    if not isinstance(note, str) or len(note) > 2000:
        return jsonify({'error': 'note must be a string with max 2000 characters'}), 400

    if not isinstance(analyst_id, str) or len(analyst_id) > 64 or not analyst_id.strip():
        return jsonify({'error': 'analyst_id must be a non-empty string with max 64 characters'}), 400

    try:
        conn = get_db_connection()
        conn.execute(
            '''UPDATE alerts
               SET verdict = ?, analyst_note = ?, analyst_id = ?, reviewed_at = ?, status = 'reviewed'
               WHERE alert_id = ?''',
            (verdict, note, analyst_id, datetime.now().isoformat(), alert_id)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error('Failed to update verdict for alert %s: %s', alert_id, e)
        return jsonify({'error': 'Failed to update alert'}), 500

    return jsonify({'success': True, 'verdict': verdict})

@app.route('/api/crypto-posture/summary', methods=['GET'])
@limiter.limit("60 per minute")
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
@limiter.limit("60 per minute")
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
@limiter.limit("10 per minute")
def update_config():
    data = request.json
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    weight_fields = ['fraud_weight', 'telemetry_weight', 'quantum_weight']
    threshold_fields = ['low_threshold', 'medium_threshold', 'high_threshold']

    for field in weight_fields + threshold_fields:
        val = data.get(field)
        if val is not None:
            if not isinstance(val, (int, float)):
                return jsonify({'error': f'{field} must be a number'}), 400
            if val < 0 or val > 1:
                return jsonify({'error': f'{field} must be between 0 and 1'}), 400

    weights = [data.get('fraud_weight', 0), data.get('telemetry_weight', 0), data.get('quantum_weight', 0)]
    if abs(sum(weights) - 1.0) > 0.01:
        return jsonify({'error': 'Weights must sum to 1.0'}), 400

    low = data.get('low_threshold', 0.3)
    medium = data.get('medium_threshold', 0.6)
    high = data.get('high_threshold', 0.8)
    if not (low < medium < high):
        return jsonify({'error': 'Thresholds must be ordered: low < medium < high'}), 400

    created_by = data.get('created_by', 'admin_001')
    if not isinstance(created_by, str) or len(created_by) > 64 or not created_by.strip():
        return jsonify({'error': 'created_by must be a non-empty string with max 64 characters'}), 400

    try:
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
    except Exception as e:
        logger.error('Failed to update config: %s', e)
        return jsonify({'error': 'Failed to update configuration'}), 500

    return jsonify({'success': True, 'config_version': config_version})

@app.route('/api/stats', methods=['GET'])
@limiter.limit("60 per minute")
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
@limiter.limit("10 per minute")
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
@limiter.limit("30 per minute")
def ingest_transaction():
    """Accept analyst-submitted transaction + telemetry, score it, return result"""
    data = request.json

    if not data or not isinstance(data, dict):
        return jsonify({'error': 'No data provided'}), 400

    transaction = data.get('transaction', {})
    telemetry = data.get('telemetry', {})
    session_id = data.get('session_id', f"sess_{random.randint(100000, 999999)}")

    if not isinstance(session_id, str) or not SESSION_ID_RE.match(session_id):
        return jsonify({'error': 'session_id must match pattern sess_[alphanumeric, max 32 chars]'}), 400

    if not isinstance(transaction, dict):
        return jsonify({'error': 'transaction must be an object'}), 400

    if not isinstance(telemetry, dict):
        return jsonify({'error': 'telemetry must be an object'}), 400

    required_tx = ['amount', 'geo_location']
    for field in required_tx:
        if field not in transaction:
            return jsonify({'error': f'Missing transaction field: {field}'}), 400

    amount = transaction.get('amount')
    if not isinstance(amount, (int, float)) or amount < 0 or amount > 10_000_000:
        return jsonify({'error': 'amount must be a number between 0 and 10,000,000'}), 400

    geo = transaction.get('geo_location')
    if geo and geo not in VALID_GEO_LOCATIONS:
        return jsonify({'error': f'Invalid geo_location. Must be one of: {sorted(VALID_GEO_LOCATIONS)}'}), 400

    if 'is_new_payee' in transaction and transaction['is_new_payee'] not in (0, 1):
        return jsonify({'error': 'is_new_payee must be 0 or 1'}), 400

    for vel_field in ['velocity_1h', 'velocity_24h']:
        val = transaction.get(vel_field)
        if val is not None:
            if not isinstance(val, int) or val < 0 or val > 1000:
                return jsonify({'error': f'{vel_field} must be an integer between 0 and 1000'}), 400

    if 'auth_event_type' in telemetry and telemetry['auth_event_type'] not in VALID_AUTH_EVENTS:
        return jsonify({'error': f'Invalid auth_event_type. Must be one of: {sorted(VALID_AUTH_EVENTS)}'}), 400

    if 'ip_address' in telemetry and not IP_RE.match(telemetry['ip_address']):
        return jsonify({'error': 'ip_address must be a valid IPv4 address'}), 400

    if 'ip_reputation_score' in telemetry:
        ip_rep = telemetry['ip_reputation_score']
        if not isinstance(ip_rep, (int, float)) or ip_rep < 0 or ip_rep > 1:
            return jsonify({'error': 'ip_reputation_score must be between 0 and 1'}), 400

    for binary_field in ['device_fingerprint_changed', 'geo_mismatch']:
        if binary_field in telemetry and telemetry[binary_field] not in (0, 1):
            return jsonify({'error': f'{binary_field} must be 0 or 1'}), 400

    if 'tls_cipher_suite' in telemetry and telemetry['tls_cipher_suite'] not in VALID_CIPHERS:
        return jsonify({'error': 'tls_cipher_suite is not a recognized cipher suite'}), 400

    if 'data_sensitivity_class' in telemetry and telemetry['data_sensitivity_class'] not in VALID_SENSITIVITY_CLASSES:
        return jsonify({'error': f'Invalid data_sensitivity_class. Must be one of: {sorted(VALID_SENSITIVITY_CLASSES)}'}), 400

    if 'failed_auth_count' in telemetry:
        fac = telemetry['failed_auth_count']
        if not isinstance(fac, int) or fac < 0 or fac > 100:
            return jsonify({'error': 'failed_auth_count must be an integer between 0 and 100'}), 400

    result = score_and_store(session_id, transaction, telemetry)

    if not result:
        return jsonify({'error': 'Scoring failed'}), 500

    return jsonify({
        'success': True,
        'session_id': session_id,
        'input': data,
        **result
    })


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _get_or_create_user(email: str, name: str = '', provider: str = 'local') -> dict:
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (email,)).fetchone()
    if not user:
        user_id = f"user_{secrets.token_hex(8)}"
        conn.execute(
            'INSERT INTO users (user_id, username, role, created_at) VALUES (?, ?, ?, ?)',
            (user_id, email, 'analyst', datetime.now().isoformat())
        )
        conn.commit()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (email,)).fetchone()
    conn.close()
    return dict(user)


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
def auth_login():
    data = request.json
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if len(email) > 254 or len(password) > 128:
        return jsonify({'error': 'Invalid credentials'}), 400

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (email,)).fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401

    user = dict(user)

    if not user.get('password_hash') or not _check_password(password, user['password_hash']):
        return jsonify({'error': 'Invalid email or password'}), 401

    session.permanent = True
    session['user_id'] = user['user_id']
    session['username'] = user['username']
    session['role'] = user['role']

    logger.info('User logged in: %s', email)
    return jsonify({
        'success': True,
        'user': {
            'user_id': user['user_id'],
            'username': user['username'],
            'role': user['role'],
            'provider': 'local'
        }
    })


@app.route('/api/auth/register', methods=['POST'])
@limiter.limit("5 per minute")
def auth_register():
    data = request.json
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if len(email) > 254 or '@' not in email:
        return jsonify({'error': 'Invalid email address'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    if len(password) > 128:
        return jsonify({'error': 'Password too long'}), 400

    conn = get_db_connection()
    existing = conn.execute('SELECT user_id FROM users WHERE username = ?', (email,)).fetchone()
    conn.close()

    if existing:
        return jsonify({'error': 'An account with this email already exists'}), 409

    user = _get_or_create_user(email)

    hashed = _hash_password(password)
    conn = get_db_connection()
    conn.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', (hashed, user['user_id']))
    conn.commit()
    conn.close()

    session.permanent = True
    session['user_id'] = user['user_id']
    session['username'] = email
    session['role'] = 'analyst'

    logger.info('User registered: %s', email)
    return jsonify({
        'success': True,
        'user': {
            'user_id': user['user_id'],
            'username': email,
            'role': 'analyst',
            'provider': 'local'
        }
    })


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    user_id = session.get('user_id', 'unknown')
    session.clear()
    logger.info('User logged out: %s', user_id)
    return jsonify({'success': True})


@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    if 'user_id' not in session:
        return jsonify({'authenticated': False}), 401
    return jsonify({
        'authenticated': True,
        'user': {
            'user_id': session['user_id'],
            'username': session.get('username', ''),
            'role': session.get('role', 'analyst'),
        }
    })


@app.route('/api/auth/google', methods=['GET'])
@limiter.limit("10 per minute")
def auth_google():
    """Redirect to Google OAuth consent screen"""
    from authlib.integrations.requests_client import OAuth2Session
    from flask import redirect as flask_redirect

    client_id = os.environ.get('GOOGLE_CLIENT_ID', '')
    redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/auth/callback/google')

    if not client_id:
        return jsonify({'error': 'Google OAuth not configured. Set GOOGLE_CLIENT_ID in your .env file.'}), 501

    scope = 'openid email profile'
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['oauth_provider'] = 'google'

    oauth = OAuth2Session(client_id=client_id, redirect_uri=redirect_uri, scope=scope, state=state)
    authorization_url, _ = oauth.create_authorization_url('https://accounts.google.com/o/oauth2/v2/auth')

    return flask_redirect(authorization_url)


@app.route('/api/auth/callback/google', methods=['GET'])
@limiter.limit("10 per minute")
def auth_callback_google():
    """Handle Google OAuth callback (Google redirects with GET ?code=...&state=...)"""
    from flask import redirect as flask_redirect

    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')

    if error:
        return flask_redirect(f'http://localhost:3000?auth_error={error}')

    if not code:
        return jsonify({'error': 'Authorization code required'}), 400

    if state != session.get('oauth_state'):
        return jsonify({'error': 'Invalid OAuth state'}), 400

    client_id = os.environ.get('GOOGLE_CLIENT_ID', '')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET', '')
    redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/auth/callback/google')

    if not client_id or not client_secret:
        return flask_redirect('http://localhost:3000?auth_error=not_configured')

    try:
        from authlib.integrations.requests_client import OAuth2Session

        oauth = OAuth2Session(client_id=client_id, redirect_uri=redirect_uri)
        token = oauth.fetch_token(
            'https://oauth2.googleapis.com/token',
            code=code,
            client_secret=client_secret,
        )

        userinfo_resp = oauth.get('https://www.googleapis.com/oauth2/v3/userinfo')
        userinfo = userinfo_resp.json()

        email = userinfo.get('email', '')
        name = userinfo.get('name', '')

        if not email:
            return flask_redirect('http://localhost:3000?auth_error=no_email')

        user = _get_or_create_user(email, name, 'google')

        session.permanent = True
        session['user_id'] = user['user_id']
        session['username'] = email
        session['role'] = user['role']

        logger.info('Google OAuth login: %s', email)
        return flask_redirect('http://localhost:3000?auth_success=1')
    except Exception as e:
        logger.error('Google OAuth callback failed: %s', e)
        return jsonify({'error': 'Google authentication failed'}), 500


@app.route('/api/auth/microsoft', methods=['GET'])
@limiter.limit("10 per minute")
def auth_microsoft():
    """Redirect to Microsoft OAuth consent screen"""
    from authlib.integrations.requests_client import OAuth2Session
    from flask import redirect as flask_redirect

    client_id = os.environ.get('MICROSOFT_CLIENT_ID', '')
    redirect_uri = os.environ.get('MICROSOFT_REDIRECT_URI', 'http://localhost:5000/api/auth/callback/microsoft')

    if not client_id:
        return jsonify({'error': 'Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID in your .env file.'}), 501

    scope = 'openid email profile User.Read'
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['oauth_provider'] = 'microsoft'

    oauth = OAuth2Session(client_id=client_id, redirect_uri=redirect_uri, scope=scope, state=state)
    authorization_url, _ = oauth.create_authorization_url(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    )

    return flask_redirect(authorization_url)


@app.route('/api/auth/callback/microsoft', methods=['GET'])
@limiter.limit("10 per minute")
def auth_callback_microsoft():
    """Handle Microsoft OAuth callback (Microsoft redirects with GET ?code=...&state=...)"""
    from flask import redirect as flask_redirect

    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')

    if error:
        return flask_redirect(f'http://localhost:3000?auth_error={error}')

    if not code:
        return jsonify({'error': 'Authorization code required'}), 400

    if state != session.get('oauth_state'):
        return jsonify({'error': 'Invalid OAuth state'}), 400

    client_id = os.environ.get('MICROSOFT_CLIENT_ID', '')
    client_secret = os.environ.get('MICROSOFT_CLIENT_SECRET', '')
    redirect_uri = os.environ.get('MICROSOFT_REDIRECT_URI', 'http://localhost:5000/api/auth/callback/microsoft')

    if not client_id or not client_secret:
        return flask_redirect('http://localhost:3000?auth_error=not_configured')

    try:
        from authlib.integrations.requests_client import OAuth2Session

        oauth = OAuth2Session(client_id=client_id, redirect_uri=redirect_uri)
        token = oauth.fetch_token(
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            code=code,
            client_secret=client_secret,
        )

        userinfo_resp = oauth.get('https://graph.microsoft.com/v1.0/me')
        userinfo = userinfo_resp.json()

        email = userinfo.get('mail') or userinfo.get('userPrincipalName', '')
        name = userinfo.get('displayName', '')

        if not email:
            return flask_redirect('http://localhost:3000?auth_error=no_email')

        user = _get_or_create_user(email, name, 'microsoft')

        session.permanent = True
        session['user_id'] = user['user_id']
        session['username'] = email
        session['role'] = user['role']

        logger.info('Microsoft OAuth login: %s', email)
        return flask_redirect('http://localhost:3000?auth_success=1')
    except Exception as e:
        logger.error('Microsoft OAuth callback failed: %s', e)
        return jsonify({'error': 'Microsoft authentication failed'}), 500


if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    app.run(debug=debug, port=int(os.environ.get('PORT', 5000)))
