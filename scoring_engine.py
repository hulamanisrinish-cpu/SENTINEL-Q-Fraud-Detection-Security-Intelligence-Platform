"""
SENTINEL-Q Scoring Engine
Computes fraud_score, telemetry_score, quantum_posture_score, and composite risk scores
"""
import sqlite3
import numpy as np
from datetime import datetime
from typing import Dict, Tuple

class ScoringEngine:
    def __init__(self, db_path: str = 'sentinel_q.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        
        # Load current scoring config
        self.config = self._load_config()
        
        # Pre-compute statistics for z-score normalization
        self.amount_stats = self._compute_amount_stats()
        self.velocity_1h_stats = self._compute_velocity_stats('velocity_1h')
        self.velocity_24h_stats = self._compute_velocity_stats('velocity_24h')
    
    def _load_config(self) -> Dict:
        """Load the latest scoring configuration"""
        config = self.conn.execute(
            'SELECT * FROM scoring_config ORDER BY created_at DESC LIMIT 1'
        ).fetchone()
        return dict(config) if config else None
    
    def _compute_amount_stats(self) -> Dict:
        """Compute mean and std for transaction amounts"""
        mean_result = self.conn.execute('SELECT AVG(amount) as mean FROM transactions').fetchone()
        mean = mean_result['mean'] or 0
        
        # Compute std manually: sqrt(avg((x - mean)^2))
        variance_result = self.conn.execute('SELECT AVG((amount - ?) * (amount - ?)) as variance FROM transactions', (mean, mean)).fetchone()
        variance = variance_result['variance'] or 0
        std = variance ** 0.5 if variance > 0 else 1
        
        return {'mean': mean, 'std': std}
    
    def _compute_velocity_stats(self, column: str) -> Dict:
        """Compute mean and std for velocity metrics"""
        mean_result = self.conn.execute(f'SELECT AVG({column}) as mean FROM transactions').fetchone()
        mean = mean_result['mean'] or 0
        
        # Compute std manually
        variance_result = self.conn.execute(f'SELECT AVG(({column} - ?) * ({column} - ?)) as variance FROM transactions', (mean, mean)).fetchone()
        variance = variance_result['variance'] or 0
        std = variance ** 0.5 if variance > 0 else 1
        
        return {'mean': mean, 'std': std}
    
    def _z_score(self, value: float, stats: Dict) -> float:
        """Compute z-score normalized to 0-1 range"""
        if stats['std'] == 0:
            return 0.0
        z = (value - stats['mean']) / stats['std']
        # Sigmoid to normalize to 0-1
        return 1 / (1 + np.exp(-z))
    
    def compute_fraud_score(self, transaction: Dict) -> float:
        """
        Compute fraud_score based on:
        - Z-score of transaction amount
        - Velocity deviation (1h and 24h)
        - New payee flag
        """
        # Amount z-score (normalized 0-1)
        amount_score = self._z_score(transaction['amount'], self.amount_stats)
        
        # Velocity scores
        velocity_1h_score = self._z_score(transaction['velocity_1h'], self.velocity_1h_stats)
        velocity_24h_score = self._z_score(transaction['velocity_24h'], self.velocity_24h_stats)
        
        # New payee flag
        new_payee_score = float(transaction['is_new_payee'])
        
        # Weighted combination
        fraud_score = (
            0.4 * amount_score +
            0.3 * velocity_1h_score +
            0.2 * velocity_24h_score +
            0.1 * new_payee_score
        )
        
        return min(max(fraud_score, 0.0), 1.0)
    
    def compute_telemetry_score(self, telemetry: Dict) -> float:
        """
        Compute telemetry_score based on:
        - IP reputation score (inverted - lower rep = higher risk)
        - Geo mismatch flag
        - Device fingerprint changed flag
        - Failed authentication count
        """
        # IP reputation (invert - bad reputation increases risk)
        ip_risk = 1.0 - telemetry['ip_reputation_score']
        
        # Binary flags
        geo_mismatch_score = float(telemetry['geo_mismatch'])
        device_changed_score = float(telemetry['device_fingerprint_changed'])
        
        # Failed auth count (normalize - assume 10+ failed is max risk)
        failed_auth_score = min(telemetry['failed_auth_count'] / 10.0, 1.0)
        
        # Weighted combination
        telemetry_score = (
            0.3 * ip_risk +
            0.25 * geo_mismatch_score +
            0.25 * device_changed_score +
            0.2 * failed_auth_score
        )
        
        return min(max(telemetry_score, 0.0), 1.0)
    
    def compute_quantum_posture_score(self, telemetry: Dict) -> float:
        """
        Compute quantum_posture_score based on:
        - TLS cipher suite strength (classical vs modern)
        - Data sensitivity class (sensitive data with weak ciphers = high risk)
        """
        # Cipher suite classification
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
            cipher_risk = 1.0  # High risk - weak classical cipher
        elif cipher_suite in modern_ciphers:
            cipher_risk = 0.0  # Low risk - modern cipher
        else:
            cipher_risk = 0.5  # Medium risk - unknown cipher
        
        # Data sensitivity classification
        sensitive_classes = ['PII', 'financial_record']
        data_sensitivity = telemetry['data_sensitivity_class']
        
        if data_sensitivity in sensitive_classes:
            sensitivity_multiplier = 1.0  # High sensitivity
        elif data_sensitivity == 'session_token':
            sensitivity_multiplier = 0.7
        else:  # public
            sensitivity_multiplier = 0.3
        
        # Combined score
        quantum_score = cipher_risk * sensitivity_multiplier
        
        return min(max(quantum_score, 0.0), 1.0)
    
    def compute_composite_score(self, fraud_score: float, telemetry_score: float, 
                                quantum_score: float) -> Tuple[float, str]:
        """
        Compute composite score using config weights and determine risk band
        """
        if not self.config:
            # Default weights if no config
            fraud_weight, telemetry_weight, quantum_weight = 0.4, 0.4, 0.2
            low_thresh, medium_thresh, high_thresh = 0.3, 0.6, 0.8
        else:
            fraud_weight = self.config['fraud_weight']
            telemetry_weight = self.config['telemetry_weight']
            quantum_weight = self.config['quantum_weight']
            low_thresh = self.config['low_threshold']
            medium_thresh = self.config['medium_threshold']
            high_thresh = self.config['high_threshold']
        
        # Weighted composite
        composite = (
            fraud_weight * fraud_score +
            telemetry_weight * telemetry_score +
            quantum_weight * quantum_score
        )
        
        # Determine risk band
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
        """
        Compute all scores for a single session
        """
        # Get transaction and telemetry for this session
        transaction = self.conn.execute(
            'SELECT * FROM transactions WHERE session_id = ?',
            (session_id,)
        ).fetchone()
        
        telemetry = self.conn.execute(
            'SELECT * FROM telemetry WHERE session_id = ?',
            (session_id,)
        ).fetchone()
        
        if not transaction or not telemetry:
            return None
        
        transaction = dict(transaction)
        telemetry = dict(telemetry)
        
        # Compute individual scores
        fraud_score = self.compute_fraud_score(transaction)
        telemetry_score = self.compute_telemetry_score(telemetry)
        quantum_score = self.compute_quantum_posture_score(telemetry)
        
        # Compute composite
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
        """
        Compute and save scores for all sessions in the database
        """
        print("Computing scores for all sessions...")
        
        # Get all session IDs
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
        
        # Insert scores into database
        print("Inserting scores into database...")
        self.conn.executemany(
            '''INSERT INTO scores 
               (score_id, session_id, fraud_score, telemetry_score, quantum_posture_score,
                composite_score, risk_band, computed_at, config_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            [(s['score_id'], s['session_id'], s['fraud_score'], s['telemetry_score'],
              s['quantum_posture_score'], s['composite_score'], s['risk_band'],
              s['computed_at'], s['config_version'])
             for s in scores_data]
        )
        
        self.conn.commit()
        
        # Print summary
        print(f"\n✅ Scoring complete!")
        print(f"   - {len(scores_data)} sessions scored")
        print(f"   - Config version: {config_version}")
        
        # Risk band distribution
        band_counts = {}
        for s in scores_data:
            band = s['risk_band']
            band_counts[band] = band_counts.get(band, 0) + 1
        
        print("\n📊 Risk Band Distribution:")
        for band in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
            count = band_counts.get(band, 0)
            pct = count / len(scores_data) * 100 if scores_data else 0
            print(f"   - {band}: {count} sessions ({pct:.1f}%)")
        
        self.conn.close()

if __name__ == '__main__':
    engine = ScoringEngine()
    engine.score_all_sessions()
