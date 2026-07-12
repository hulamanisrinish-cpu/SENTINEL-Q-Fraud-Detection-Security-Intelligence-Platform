import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, ShieldAlert, ShieldCheck, Key } from 'lucide-react'

export function CryptoPosture() {
  const [posture, setPosture] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCryptoPosture()
  }, [])

  const fetchCryptoPosture = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/crypto-posture/summary')
      const data = await response.json()
      setPosture(data)
    } catch (error) {
      console.error('Failed to fetch crypto posture:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
        <div className="skeleton h-48" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-4xl font-semibold font-display tracking-tight">Quantum Posture</h2>
        <p className="text-sm font-mono text-white/30 mt-2">Cryptographic vulnerability assessment</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard
          icon={<Lock className="w-6 h-6 text-red-400" />}
          label="CLASSICAL-ONLY"
          value={posture.classical_only_sessions}
          total={posture.total_sessions}
          percentage={posture.classical_only_percentage}
          variant="warning"
        />
        <SummaryCard
          icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
          label="MODERN CIPHER"
          value={posture.modern_cipher_sessions}
          total={posture.total_sessions}
          percentage={posture.modern_percentage}
          variant="safe"
        />
      </div>

      {/* Sensitive Data Warning */}
      {posture.sensitive_data_weak_cipher > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 glow-red"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
              <ShieldAlert className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold font-display mb-1 text-white/80">QUANTUM RISK DETECTED</h3>
              <p className="text-sm font-mono text-white/30">
                {posture.sensitive_data_weak_cipher} sessions using weak classical ciphers with sensitive data (PII/financial records)
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Breakdown */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Key className="w-4 h-4" />
          Cipher Suite Breakdown
        </h3>
        <div className="space-y-3">
          {posture.breakdown.map((item: any, index: number) => {
            const isWeak = item.cipher_suite.includes('RSA_WITH') || item.cipher_suite.includes('3DES')
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between text-sm border-b border-white/5 pb-3 last:border-0"
              >
                <div className="flex-1">
                  <div className="font-mono font-semibold text-white/70 text-xs">{item.cipher_suite}</div>
                  <div className="text-[10px] font-mono text-white/20 uppercase mt-1">{item.data_sensitivity}</div>
                </div>
                <div className="flex items-center gap-3">
                  {isWeak && (
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-mono font-semibold rounded-full border border-red-500/20">WEAK</span>
                  )}
                  <div className="font-mono font-semibold text-lg text-white/60">{item.count}</div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, total, percentage, variant }: {
  icon: React.ReactNode
  label: string
  value: number
  total: number
  percentage: number
  variant: 'warning' | 'safe'
}) {
  const borderColor = variant === 'warning' ? 'border-red-500/10' : 'border-emerald-500/10'
  const bgColor = variant === 'warning' ? 'bg-red-500/[0.03]' : 'bg-emerald-500/[0.03]'

  return (
    <div className={`glass-card p-6 ${bgColor} border ${borderColor}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white/5 rounded-xl">{icon}</div>
        <div className="text-xs font-mono font-semibold text-white/30">{label}</div>
      </div>
      <div className="text-4xl font-semibold font-display mb-1">{value}</div>
      <div className="text-xs font-mono text-white/20 mt-2">
        {percentage.toFixed(1)}% of {total} sessions
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-3">
        <motion.div
          className={`h-full rounded-full ${variant === 'warning' ? 'bg-red-500/40' : 'bg-emerald-500/40'}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
    </div>
  )
}
