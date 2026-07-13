import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Zap, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ArrowRight, Shield } from 'lucide-react'
import { apiFetch } from '../api'

interface IngestResult {
  success: boolean
  session_id: string
  risk_band: string
  composite_score: number
  fraud_score: number
  telemetry_score: number
  quantum_posture_score: number
  alert_id: number | null
}

export function LiveInput({ onNewData }: { onNewData: () => void }) {
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const [txAmount, setTxAmount] = useState('50000')
  const [txGeo, setTxGeo] = useState('US-East')
  const [txNewPayee, setTxNewPayee] = useState('0')
  const [txVelocity1h, setTxVelocity1h] = useState('5')
  const [txVelocity24h, setTxVelocity24h] = useState('20')

  const [telIpRep, setTelIpRep] = useState('0.3')
  const [telDeviceChanged, setTelDeviceChanged] = useState('1')
  const [telGeoMismatch, setTelGeoMismatch] = useState('1')
  const [telCipher, setTelCipher] = useState('TLS_RSA_WITH_AES_256_CBC_SHA')
  const [telSensitivity, setTelSensitivity] = useState('financial_record')
  const [telFailedAuth, setTelFailedAuth] = useState('4')

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [result])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setShowSuccess(false)

    try {
      const response = await apiFetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: {
            amount: parseInt(txAmount),
            geo_location: txGeo,
            is_new_payee: parseInt(txNewPayee),
            velocity_1h: parseInt(txVelocity1h),
            velocity_24h: parseInt(txVelocity24h),
          },
          telemetry: {
            ip_reputation_score: parseFloat(telIpRep),
            device_fingerprint_changed: parseInt(telDeviceChanged),
            geo_mismatch: parseInt(telGeoMismatch),
            tls_cipher_suite: telCipher,
            data_sensitivity_class: telSensitivity,
            failed_auth_count: parseInt(telFailedAuth),
          }
        })
      })
      const data = await response.json()
      setResult(data)
      setShowSuccess(true)
      onNewData()
      setTimeout(() => setShowSuccess(false), 4000)
    } catch (error) {
      console.error('Ingest failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPreset = (preset: 'suspicious' | 'normal' | 'critical') => {
    setResult(null)
    setShowSuccess(false)
    if (preset === 'critical') {
      setTxAmount('450000'); setTxGeo('AP-South'); setTxNewPayee('1'); setTxVelocity1h('15'); setTxVelocity24h('60')
      setTelIpRep('0.1'); setTelDeviceChanged('1'); setTelGeoMismatch('1'); setTelCipher('TLS_RSA_WITH_AES_256_CBC_SHA'); setTelSensitivity('financial_record'); setTelFailedAuth('8')
    } else if (preset === 'suspicious') {
      setTxAmount('125000'); setTxGeo('EU-West'); setTxNewPayee('1'); setTxVelocity1h('7'); setTxVelocity24h('30')
      setTelIpRep('0.35'); setTelDeviceChanged('1'); setTelGeoMismatch('0'); setTelCipher('TLS_RSA_WITH_3DES_EDE_CBC_SHA'); setTelSensitivity('PII'); setTelFailedAuth('3')
    } else {
      setTxAmount('2500'); setTxGeo('US-East'); setTxNewPayee('0'); setTxVelocity1h('1'); setTxVelocity24h('5')
      setTelIpRep('0.9'); setTelDeviceChanged('0'); setTelGeoMismatch('0'); setTelCipher('TLS_AES_256_GCM_SHA384'); setTelSensitivity('public'); setTelFailedAuth('0')
    }
  }

  const getRiskStyle = (band: string) => {
    switch (band) {
      case 'CRITICAL': return 'glow-red'
      case 'HIGH': return 'glow-amber'
      default: return ''
    }
  }

  return (
    <div className="glass-card-light overflow-hidden">
      {/* Success toast */}
      <AnimatePresence>
        {showSuccess && result && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`mx-6 mt-6 p-4 rounded-2xl flex items-center gap-3 ${
              result.alert_id ? 'bg-red-500/10 border border-red-500/20' : 'bg-black/5 border border-black/5'
            }`}
          >
            {result.alert_id ? (
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="text-xs font-mono font-semibold">
                {result.alert_id
                  ? `ALERT #${result.alert_id} GENERATED — Risk: ${result.risk_band}`
                  : `SCORED: ${result.risk_band} — Below alert threshold`}
              </div>
              <div className="text-[10px] font-mono text-black/30 mt-1">
                Session {result.session_id} • Composite {(result.composite_score * 100).toFixed(1)}%
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-black/20 flex-shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black/10 rounded-xl">
            <Send className="w-4 h-4 text-black/50" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-mono font-semibold text-black/40 uppercase tracking-wider">Live Data Input</h3>
            <p className="text-xs font-mono text-black/25 mt-1">Submit transaction + telemetry for real-time scoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <motion.div
              className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-[10px] font-mono font-semibold text-emerald-600">READY</span>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-black/20" /> : <ChevronDown className="w-5 h-5 text-black/20" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              {/* Presets */}
              <div className="flex gap-2 mb-6">
                <button onClick={() => loadPreset('critical')} className="px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-full text-[10px] font-mono font-semibold hover:bg-red-500/15 transition-all flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  CRITICAL
                </button>
                <button onClick={() => loadPreset('suspicious')} className="px-4 py-2 bg-orange-500/10 text-orange-600 border border-orange-500/20 rounded-full text-[10px] font-mono font-semibold hover:bg-orange-500/15 transition-all flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  SUSPICIOUS
                </button>
                <button onClick={() => loadPreset('normal')} className="px-4 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full text-[10px] font-mono font-semibold hover:bg-emerald-500/15 transition-all flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3" />
                  NORMAL
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono font-semibold text-black/30 uppercase tracking-widest border-b border-black/5 pb-2">Transaction</h4>
                    <InputField label="AMOUNT (₹)" value={txAmount} onChange={setTxAmount} type="number" />
                    <div>
                      <label className="text-[10px] font-mono font-semibold text-black/30 block mb-1">GEO LOCATION</label>
                      <select value={txGeo} onChange={e => setTxGeo(e.target.value)} className="w-full bg-black/5 text-black rounded-xl px-3 py-2 text-xs font-mono border border-black/5 focus:border-black/20 outline-none transition-colors">
                        {['US-East', 'US-West', 'EU-West', 'AP-South', 'SA-East'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <InputField label="VELOCITY 1H" value={txVelocity1h} onChange={setTxVelocity1h} type="number" />
                    <InputField label="VELOCITY 24H" value={txVelocity24h} onChange={setTxVelocity24h} type="number" />
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={txNewPayee === '1'} onChange={e => setTxNewPayee(e.target.checked ? '1' : '0')} className="accent-black" />
                      <label className="text-[10px] font-mono font-semibold text-black/30">NEW PAYEE</label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono font-semibold text-black/30 uppercase tracking-widest border-b border-black/5 pb-2">Telemetry</h4>
                    <InputField label="IP REPUTATION (0-1)" value={telIpRep} onChange={setTelIpRep} type="number" step="0.05" />
                    <InputField label="FAILED AUTH COUNT" value={telFailedAuth} onChange={setTelFailedAuth} type="number" />
                    <div>
                      <label className="text-[10px] font-mono font-semibold text-black/30 block mb-1">CIPHER SUITE</label>
                      <select value={telCipher} onChange={e => setTelCipher(e.target.value)} className="w-full bg-black/5 text-black rounded-xl px-3 py-2 text-xs font-mono border border-black/5 focus:border-black/20 outline-none transition-colors">
                        <option value="TLS_RSA_WITH_AES_256_CBC_SHA">TLS_RSA_WITH_AES_256_CBC_SHA (WEAK)</option>
                        <option value="TLS_RSA_WITH_3DES_EDE_CBC_SHA">TLS_RSA_WITH_3DES_EDE_CBC_SHA (WEAK)</option>
                        <option value="TLS_AES_256_GCM_SHA384">TLS_AES_256_GCM_SHA384 (MODERN)</option>
                        <option value="TLS_CHACHA20_POLY1305_SHA256">TLS_CHACHA20_POLY1305_SHA256 (MODERN)</option>
                        <option value="TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384">TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 (MODERN)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono font-semibold text-black/30 block mb-1">DATA SENSITIVITY</label>
                      <select value={telSensitivity} onChange={e => setTelSensitivity(e.target.value)} className="w-full bg-black/5 text-black rounded-xl px-3 py-2 text-xs font-mono border border-black/5 focus:border-black/20 outline-none transition-colors">
                        {['financial_record', 'PII', 'transactional', 'session_token', 'public'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={telDeviceChanged === '1'} onChange={e => setTelDeviceChanged(e.target.checked ? '1' : '0')} className="accent-black" />
                        <label className="text-[10px] font-mono font-semibold text-black/30">DEVICE CHANGED</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={telGeoMismatch === '1'} onChange={e => setTelGeoMismatch(e.target.checked ? '1' : '0')} className="accent-black" />
                        <label className="text-[10px] font-mono font-semibold text-black/30">GEO MISMATCH</label>
                      </div>
                    </div>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 bg-black text-white rounded-2xl font-mono font-semibold text-sm disabled:opacity-50 transition-all hover:bg-black/80"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      SCORING...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      SUBMIT & SCORE
                    </>
                  )}
                </motion.button>
              </form>

              {/* Result display */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    ref={resultRef}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`mt-6 p-6 rounded-2xl border ${
                      result.risk_band === 'CRITICAL' || result.risk_band === 'HIGH'
                        ? `bg-black/90 border-white/10 ${getRiskStyle(result.risk_band)}`
                        : 'bg-black/5 border-black/5'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5">
                      {result.risk_band === 'CRITICAL' || result.risk_band === 'HIGH' ? (
                        <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.5, delay: 0.2 }}>
                          <AlertTriangle className="w-5 h-5 text-white" />
                        </motion.div>
                      ) : (
                        <CheckCircle className="w-5 h-5 text-white/30" />
                      )}
                      <span className="text-xs font-mono font-semibold text-white/50 uppercase tracking-wider">Scoring Result</span>
                      <div className={`ml-auto px-3 py-1 rounded-full text-[10px] font-mono font-bold ${
                        result.risk_band === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/20' :
                        result.risk_band === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                        result.risk_band === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        'bg-white/5 text-white/40 border border-white/10'
                      }`}>
                        {result.risk_band}
                      </div>
                    </div>

                    {/* Score cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <ScoreCard label="COMPOSITE" value={`${(result.composite_score * 100).toFixed(1)}%`} highlight={result.risk_band === 'CRITICAL' || result.risk_band === 'HIGH'} />
                      <ScoreCard label="FRAUD" value={`${(result.fraud_score * 100).toFixed(1)}%`} highlight={result.fraud_score > 0.6} />
                      <ScoreCard label="TELEMETRY" value={`${(result.telemetry_score * 100).toFixed(1)}%`} highlight={result.telemetry_score > 0.6} />
                      <ScoreCard label="QUANTUM" value={`${(result.quantum_posture_score * 100).toFixed(1)}%`} highlight={result.quantum_posture_score > 0.6} />
                    </div>

                    {/* Score bars */}
                    <div className="space-y-2 mb-4">
                      <ScoreBar label="FRAUD SIGNAL" value={result.fraud_score} />
                      <ScoreBar label="TELEMETRY SIGNAL" value={result.telemetry_score} />
                      <ScoreBar label="QUANTUM POSTURE" value={result.quantum_posture_score} />
                    </div>

                    {/* Alert info */}
                    {result.alert_id ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center gap-2 p-3 bg-white/5 rounded-xl text-[10px] font-mono text-white/30 border border-white/5"
                      >
                        <Zap className="w-3 h-3 text-red-400" />
                        <span className="text-white/60 font-semibold">ALERT #{result.alert_id}</span>
                        <span className="text-white/15">•</span>
                        <span>Session: {result.session_id.slice(0, 16)}...</span>
                        <span className="ml-auto text-white/30">Check Alert Queue ↓</span>
                      </motion.div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl text-[10px] font-mono text-white/25 border border-white/5">
                        <Shield className="w-3 h-3" />
                        <span>Below alert threshold — No alert generated</span>
                        <span className="ml-auto">Session: {result.session_id.slice(0, 16)}...</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function InputField({ label, value, onChange, type = 'text', step }: { label: string; value: string; onChange: (v: string) => void; type?: string; step?: string }) {
  return (
    <div>
      <label className="text-[10px] font-mono font-semibold text-black/30 block mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/5 text-black rounded-xl px-3 py-2 text-xs font-mono border border-black/5 focus:border-black/20 outline-none transition-colors"
      />
    </div>
  )
}

function ScoreCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <motion.div
      className={`rounded-xl p-3 border ${highlight ? 'bg-black/80 border-white/10' : 'bg-black/5 border-black/5'}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className={`text-[10px] font-mono mb-1 ${highlight ? 'text-white/40' : 'text-black/30'}`}>{label}</div>
      <div className={`text-sm font-mono font-bold ${highlight ? 'text-white' : 'text-black/80'}`}>{value}</div>
    </motion.div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 0.8) return 'bg-white'
    if (v >= 0.6) return 'bg-black/60'
    if (v >= 0.3) return 'bg-black/30'
    return 'bg-black/15'
  }

  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="font-mono text-black/30 font-semibold">{label}</span>
        <span className="font-mono font-bold text-black/60">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getColor(value)}`}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
    </div>
  )
}
