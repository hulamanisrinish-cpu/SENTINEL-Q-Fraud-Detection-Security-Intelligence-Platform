import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Activity, Lock, CheckCircle, XCircle, Cpu } from 'lucide-react'
import { apiFetch } from '../api'

interface AlertDetailProps {
  alertId: string
  onBack: () => void
}

export function AlertDetail({ alertId, onBack }: AlertDetailProps) {
  const [alert, setAlert] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetchAlertDetail()
  }, [alertId])

  const fetchAlertDetail = async () => {
    try {
      setLoading(true)
      const response = await apiFetch(`/api/alerts/${alertId}`)
      const data = await response.json()
      setAlert(data)
    } catch (error) {
      console.error('Failed to fetch alert detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerdict = async (verdict: string) => {
    try {
      await apiFetch(`/api/alerts/${alertId}/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict, note, analyst_id: 'analyst_001' })
      })
      onBack()
    } catch (error) {
      console.error('Failed to submit verdict:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-48" />
        <div className="skeleton h-32" />
      </div>
    )
  }

  if (!alert) {
    return (
      <div className="text-center py-16 glass-card">
        <div className="text-white/20 font-mono">ALERT NOT FOUND</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-mono text-white/30 hover:text-white/60 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        RETURN TO QUEUE
      </button>

      {/* Score Breakdown */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          Composite Risk Score
        </h3>
        <div className="flex items-center gap-6 mb-6">
          <div className="text-5xl font-semibold font-display">
            {(alert.scores.composite_score * 100).toFixed(0)}%
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-mono font-semibold border ${
            alert.scores.risk_band === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
            alert.scores.risk_band === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
            'bg-white/5 text-white/40 border-white/10'
          }`}>
            {alert.scores.risk_band}
          </div>
        </div>
        <div className="space-y-4">
          <ScoreBar label="FRAUD SIGNAL" value={alert.scores.fraud_score} />
          <ScoreBar label="TELEMETRY SIGNAL" value={alert.scores.telemetry_score} />
          <ScoreBar label="QUANTUM POSTURE" value={alert.scores.quantum_posture_score} />
        </div>
      </div>

      {/* Transaction */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Transaction Evidence
        </h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <DetailRow label="TRANSACTION AMOUNT" value={`₹${alert.transaction.amount.toLocaleString()}`} />
          <DetailRow label="GEO LOCATION" value={alert.transaction.geo_location} />
          <DetailRow label="DEVICE ID" value={alert.transaction.device_id} />
          <DetailRow label="PAYEE ID" value={alert.transaction.payee_id} />
          <DetailRow label="NEW PAYEE" value={alert.transaction.is_new_payee ? 'YES' : 'NO'} />
          <DetailRow label="VELOCITY (1H)" value={alert.transaction.velocity_1h.toString()} />
          <DetailRow label="VELOCITY (24H)" value={alert.transaction.velocity_24h.toString()} />
        </div>
      </div>

      {/* Telemetry */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Security Telemetry
        </h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <DetailRow label="IP REPUTATION" value={(alert.telemetry.ip_reputation_score * 100).toFixed(0) + '%'} />
          <DetailRow label="DEVICE CHANGED" value={alert.telemetry.device_fingerprint_changed ? 'YES' : 'NO'} />
          <DetailRow label="GEO MISMATCH" value={alert.telemetry.geo_mismatch ? 'YES' : 'NO'} />
          <DetailRow label="FAILED AUTH" value={alert.telemetry.failed_auth_count.toString()} />
          <DetailRow label="CIPHER SUITE" value={alert.telemetry.tls_cipher_suite} />
        </div>
      </div>

      {/* SHAP */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Feature Attribution (SHAP)
        </h3>
        <div className="space-y-3">
          {Object.entries(alert.shap_features || {}).map(([feature, value]: [string, any]) => (
            <div key={feature} className="flex items-center justify-between text-sm border-b border-white/5 pb-3 last:border-0">
              <span className="text-white/25 font-mono text-xs uppercase">{feature}</span>
              <span className="font-mono font-semibold text-white/60">{value.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ENTER ANALYST NOTES..."
          className="w-full glass-card p-6 text-sm text-white placeholder-white/15 resize-none font-mono focus:outline-none focus:border-white/15"
          rows={3}
        />
        <div className="flex gap-4">
          <motion.button
            onClick={() => handleVerdict('false_positive')}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/5 text-white/60 rounded-2xl border border-white/5 hover:bg-white/10 transition-all font-mono font-semibold"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <CheckCircle className="w-5 h-5" />
            FALSE POSITIVE
          </motion.button>
          <motion.button
            onClick={() => handleVerdict('escalated')}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 hover:bg-red-500/15 transition-all font-mono font-semibold"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <XCircle className="w-5 h-5" />
            ESCALATE
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 0.8) return 'bg-white'
    if (v >= 0.6) return 'bg-white/60'
    if (v >= 0.3) return 'bg-white/30'
    return 'bg-white/10'
  }

  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-white/30 font-mono font-semibold">{label}</span>
        <span className="font-mono font-bold text-white/50">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getColor(value)}`}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/20 text-xs font-mono font-semibold uppercase mb-1">{label}</div>
      <div className="font-mono text-sm text-white/60">{value}</div>
    </div>
  )
}
