"""
SENTINEL-Q Scoring Engine
Computes fraud_score, telemetry_score, quantum_posture_score, and composite risk scores
"""
import os
import numpy as np
from datetime import datetime
from typing import Dict, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


def _normalize_db_url(url):
    if not url:
        return ''
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    if 'sslmode' not in url:
        sep = '&' if '?' in url else '?'
        url = f'{url}{sep}sslmode=require'
    return url


def _is_valid_pg_url(url):
    return url and url.startswith('postgresql://')


def get_connection():
    database_url = _normalize_db_url(os.environ.get('DATABASE_URL', ''))
    if _is_valid_pg_url(database_url):
        try:
            import db_compat
            return db_compat.wrap_pg(psycopg2.connect(database_url, cursor_factory=RealDictCursor))
        except Exception:
            pass
    import db_compat
    db_path = os.path.join(os.path.dirname(__file__), '..', 'sentinel_q.db')
    return db_compat.connect(db_path)


class ScoringEngine:
    def __init__(self, db_path_or_url: str = None):
        database_url = _normalize_db_url(os.environ.get('DATABASE_URL', ''))
        if _is_valid_pg_url(database_url):
            try:
                import db_compat
                self.conn = db_compat.wrap_pg(psycopg2.connect(database_url, cursor_factory=RealDictCursor))
            except Exception:
                self.conn = get_connection()
        elif db_path_or_url and not db_path_or_url.startswith('postgres'):
            import db_compat
            self.conn = db_compat.connect(db_path_or_url)
        else:
            self.conn = get_connection()

        self.config = self._load_config()
        self.amount_stats = self._compute_amount_stats()
        self.velocity_1h_stats = self._compute_velocity_stats('velocity_1h')
        self.velocity_24h_stats = self._compute_velocity_stats('velocity_24h')

    def _load_config(self) -> Dict:
        config = self.conn.execute(
            'SELECT * FROM scoring_config ORDER BY created_at DESC LIMIT 1'
        ).fetchone()
        if not config:
            return None
        d = dict(config)
        for k in d:
            if isinstance(d[k], (int, float)):
                continue
            try:
                d[k] = float(d[k])
            except (TypeError, ValueError):
                pass
        return d

    def _compute_amount_stats(self) -> Dict:
        mean_result = self.conn.execute('SELECT AVG(amount) as mean FROM transactions').fetchone()
        mean = float(mean_result['mean'] or 0)

        variance_result = self.conn.execute(
            'SELECT AVG((amount - %s) * (amount - %s)) as variance FROM transactions',
            (mean, mean)
        ).fetchone() if hasattr(self.conn, 'execute') else None

        if variance_result is None:
            variance_result = self.conn.execute(
                'SELECT AVG((amount - ?) * (amount - ?)) as variance FROM transactions',
                (mean, mean)
            ).fetchone()

        variance = float(variance_result['variance'] or 0)
        std = variance ** 0.5 if variance > 0 else 1
        return {'mean': mean, 'std': std}

    def _compute_velocity_stats(self, column: str) -> Dict:
        mean_result = self.conn.execute(f'SELECT AVG({column}) as mean FROM transactions').fetchone()
        mean = float(mean_result['mean'] or 0)

        try:
            variance_result = self.conn.execute(
                f'SELECT AVG(({column} - %s) * ({column} - %s)) as variance FROM transactions',
                (mean, mean)
            ).fetchone()
        except Exception:
            variance_result = self.conn.execute(
                f'SELECT AVG(({column} - ?) * ({column} - ?)) as variance FROM transactions',
                (mean, mean)
            ).fetchone()

        variance = float(variance_result['variance'] or 0)
        std = variance ** 0.5 if variance > 0 else 1
        return {'mean': mean, 'std': std}

    def _z_score(self, value: float, stats: Dict) -> float:
        if stats['std'] == 0:
            return 0.0
        z = (value - stats['mean']) / stats['std']
        return float(1 / (1 + np.exp(-z)))

    def compute_fraud_score(self, transaction: Dict) -> float:
        amount_score = self._z_score(float(transaction['amount']), self.amount_stats)
        velocity_1h_score = self._z_score(float(transaction['velocity_1h']), self.velocity_1h_stats)
        velocity_24h_score = self._z_score(float(transaction['velocity_24h']), self.velocity_24h_stats)
        new_payee_score = float(transaction['is_new_payee'])

        fraud_score = (
            0.4 * amount_score +
            0.3 * velocity_1h_score +
            0.2 * velocity_24h_score +
            0.1 * new_payee_score
        )
        return min(max(fraud_score, 0.0), 1.0)

    def compute_telemetry_score(self, telemetry: Dict) -> float:
        ip_risk = 1.0 - float(telemetry['ip_reputation_score'])
        geo_mismatch_score = float(telemetry['geo_mismatch'])
        device_changed_score = float(telemetry['device_fingerprint_changed'])
        failed_auth_score = min(float(telemetry['failed_auth_count']) / 10.0, 1.0)

        telemetry_score = (
            0.3 * ip_risk +
            0.25 * geo_mismatch_score +
            0.25 * device_changed_score +
            0.2 * failed_auth_score
        )
        return min(max(telemetry_score, 0.0), 1.0)

    def compute_quantum_posture_score(self, telemetry: Dict) -> float:
        weak_ciphers = [
            'TLS_RSA_WITH_AES_256_CBC_SHA',
            'TLS_RSA_WITH_3DES_EDE_CBC_SHA'
        ]
        modern_ciphers = [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256',
            'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384'
        ]

        cipher_suite = telemetry['tls_cipher_suite']
        if cipher_suite in weak_ciphers:
            cipher_risk = 1.0
        elif cipher_suite in modern_ciphers:
            cipher_risk = 0.0
        else:
            cipher_risk = 0.5

        sensitive_classes = ['PII', 'financial_record']
        data_sensitivity = telemetry['data_sensitivity_class']

        if data_sensitivity in sensitive_classes:
            sensitivity_multiplier = 1.0
        elif data_sensitivity == 'session_token':
            sensitivity_multiplier = 0.7
        else:
            sensitivity_multiplier = 0.3

        quantum_score = cipher_risk * sensitivity_multiplier
        return min(max(quantum_score, 0.0), 1.0)

    def compute_composite_score(self, fraud_score: float, telemetry_score: float,
                                quantum_score: float) -> Tuple[float, str]:
        if not self.config:
            fraud_weight, telemetry_weight, quantum_weight = 0.4, 0.4, 0.2
            low_thresh, medium_thresh, high_thresh = 0.3, 0.6, 0.8
        else:
            fraud_weight = self.config['fraud_weight']
            telemetry_weight = self.config['telemetry_weight']
            quantum_weight = self.config['quantum_weight']
            low_thresh = self.config['low_threshold']
            medium_thresh = self.config['medium_threshold']
            high_thresh = self.config['high_threshold']

        composite = (
            fraud_weight * fraud_score +
            telemetry_weight * telemetry_score +
            quantum_weight * quantum_score
        )

        if composite >= high_thresh:
            risk_band = 'CRITICAL'
        elif composite >= medium_thresh:
            risk_band = 'HIGH'
        elif composite >= low_thresh:
            risk_band = 'MEDIUM'
        else:
            risk_band = 'LOW'

        return composite, risk_band

    def score_session(self, session_id: str) -> Dict:
        transaction = self.conn.execute(
            'SELECT * FROM transactions WHERE session_id = %s',
            (session_id,)
        ).fetchone()

        telemetry = self.conn.execute(
            'SELECT * FROM telemetry WHERE session_id = %s',
            (session_id,)
        ).fetchone()

        if not transaction or not telemetry:
            return None

        transaction = dict(transaction)
        telemetry = dict(telemetry)

        fraud_score = self.compute_fraud_score(transaction)
        telemetry_score = self.compute_telemetry_score(telemetry)
        quantum_score = self.compute_quantum_posture_score(telemetry)

        composite_score, risk_band = self.compute_composite_score(
            fraud_score, telemetry_score, quantum_score
        )

        return {
            'session_id': session_id,
            'fraud_score': fraud_score,
            'telemetry_score': telemetry_score,
            'quantum_posture_score': quantum_score,
            'composite_score': composite_score,
            'risk_band': risk_band
        }

    def score_all_sessions(self):
        print("Computing scores for all sessions...")

        sessions = self.conn.execute('SELECT DISTINCT session_id FROM transactions').fetchall()
        session_ids = [row['session_id'] for row in sessions]

        config_version = self.config['config_version'] if self.config else 'default'

        scores_data = []
        for i, session_id in enumerate(session_ids):
            score_result = self.score_session(session_id)

            if score_result:
                scores_data.append({
                    'score_id': f"score_{session_id[:8]}",
                    'session_id': session_id,
                    'fraud_score': score_result['fraud_score'],
                    'telemetry_score': score_result['telemetry_score'],
                    'quantum_posture_score': score_result['quantum_posture_score'],
                    'composite_score': score_result['composite_score'],
                    'risk_band': score_result['risk_band'],
                    'computed_at': datetime.now(),
                    'config_version': config_version
                })

            if (i + 1) % 100 == 0:
                print(f"  Scored {i + 1}/{len(session_ids)} sessions...")

        print("Inserting scores into database...")
        for s in scores_data:
            self.conn.execute(
                '''INSERT INTO scores
                   (score_id, session_id, fraud_score, telemetry_score, quantum_posture_score,
                    composite_score, risk_band, computed_at, config_version)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (score_id) DO NOTHING''',
                (s['score_id'], s['session_id'], s['fraud_score'], s['telemetry_score'],
                 s['quantum_posture_score'], s['composite_score'], s['risk_band'],
                 s['computed_at'], s['config_version'])
            )

        self.conn.commit()

        print(f"\nScoring complete!")
        print(f"   - {len(scores_data)} sessions scored")
        print(f"   - Config version: {config_version}")

        band_counts = {}
        for s in scores_data:
            band = s['risk_band']
            band_counts[band] = band_counts.get(band, 0) + 1

        print("\nRisk Band Distribution:")
        for band in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
            count = band_counts.get(band, 0)
            pct = count / len(scores_data) * 100 if scores_data else 0
            print(f"   - {band}: {count} sessions ({pct:.1f}%)")

        self.conn.close()


if __name__ == '__main__':
    engine = ScoringEngine()
    engine.score_all_sessions()
