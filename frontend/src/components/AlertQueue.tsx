import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Shield, Clock, Zap } from 'lucide-react'
import { apiFetch } from '../api'

interface Alert {
  alert_id: string
  session_id: string
  status: string
  composite_score: number
  risk_band: string
  transaction: {
    amount: number
    geo_location: string
  }
}

interface AlertQueueProps {
  onAlertSelect: (alertId: string) => void
  refreshKey?: number
}

export function AlertQueue({ onAlertSelect, refreshKey }: AlertQueueProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set())
  const prevAlertIdsRef = useRef<Set<string>>(new Set<string>())

  useEffect(() => {
    fetchAlerts()
  }, [filter, refreshKey])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const url = filter === 'all'
        ? '/api/alerts?limit=50'
        : `/api/alerts?risk_band=${filter}&limit=50`
      const response = await apiFetch(url)
      const data = await response.json()

      const currentIds = new Set<string>(data.map((a: Alert) => a.alert_id))
      const newIds = new Set<string>()
      currentIds.forEach(id => {
        if (!prevAlertIdsRef.current.has(id)) {
          newIds.add(id)
        }
      })

      if (newIds.size > 0) {
        setNewAlertIds(newIds)
        setTimeout(() => setNewAlertIds(new Set()), 3000)
      }

      prevAlertIdsRef.current = currentIds
      setAlerts(data)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRiskStyle = (band: string) => {
    switch (band) {
      case 'CRITICAL': return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' }
      case 'HIGH': return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-400' }
      case 'MEDIUM': return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', dot: 'bg-yellow-400' }
      default: return { bg: 'bg-white/5', text: 'text-white/40', border: 'border-white/10', dot: 'bg-white/40' }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-6">
            <div className="skeleton h-20 w-full" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-mono font-semibold transition-all border ${
              filter === f
                ? 'bg-white/10 text-white border-white/15'
                : 'bg-white/[0.02] text-white/25 border-white/5 hover:border-white/10 hover:text-white/40'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex flex-col gap-3">
        {alerts.length === 0 ? (
          <div className="text-center py-16 glass-card">
            <Zap className="w-10 h-10 text-white/10 mx-auto mb-4" />
            <div className="text-white/20 font-mono text-sm">NO THREATS DETECTED</div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {alerts.map((alert, index) => {
              const isNew = newAlertIds.has(alert.alert_id)
              const risk = getRiskStyle(alert.risk_band)
              return (
                <motion.div
                  key={alert.alert_id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.02 }}
                  onClick={() => onAlertSelect(alert.alert_id)}
                  className={`glass-card p-5 cursor-pointer ${
                    isNew ? 'glow-white border-white/15' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${risk.bg} border ${risk.border}`}>
                        <AlertTriangle className={`w-5 h-5 ${risk.text}`} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold font-display text-white/80">
                          {alert.transaction.geo_location}
                        </div>
                        <div className="text-xs font-mono text-white/20 mt-1">
                          ID: {alert.session_id.slice(0, 16)}...
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold font-display">
                        {(alert.composite_score * 100).toFixed(0)}%
                      </div>
                      <div className={`text-[10px] font-mono font-bold mt-1 ${risk.text}`}>
                        {alert.risk_band}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
                    <div className="flex items-center gap-5">
                      <span className="flex items-center gap-1.5 text-white/25">
                        <Shield className="w-3.5 h-3.5" />
                        <span className="font-mono">₹{alert.transaction.amount.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-white/25">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-mono">{alert.status.toUpperCase()}</span>
                      </span>
                    </div>
                    <span className="text-white/30 font-mono font-semibold group-hover:text-white/50">
                      ANALYZE →
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
