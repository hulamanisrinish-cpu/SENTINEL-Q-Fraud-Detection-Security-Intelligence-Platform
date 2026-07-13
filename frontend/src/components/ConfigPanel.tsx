import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Save, Sliders } from 'lucide-react'
import { apiFetch } from '../api'

export function ConfigPanel() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await apiFetch('/api/config')
      const data = await response.json()
      setConfig(data)
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await apiFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      fetchConfig()
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
    )
  }

  const totalWeight = config.fraud_weight + config.telemetry_weight + config.quantum_weight
  const isValid = Math.abs(totalWeight - 1.0) < 0.01

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold font-display tracking-tight">System Config</h2>
          <p className="text-sm font-mono text-white/30 mt-2">Scoring parameters and thresholds</p>
        </div>
        <motion.button
          onClick={handleSave}
          disabled={saving || !isValid}
          className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white/80 rounded-2xl font-mono font-semibold text-sm border border-white/5 hover:bg-white/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Save className="w-4 h-4" />
          {saving ? 'SAVING...' : 'SAVE CONFIG'}
        </motion.button>
      </div>

      {/* Weights */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Composite Score Weights
        </h3>
        <div className="space-y-6">
          <Slider
            label="FRAUD WEIGHT"
            value={config.fraud_weight}
            onChange={(v: number) => setConfig({ ...config, fraud_weight: v })}
          />
          <Slider
            label="TELEMETRY WEIGHT"
            value={config.telemetry_weight}
            onChange={(v: number) => setConfig({ ...config, telemetry_weight: v })}
          />
          <Slider
            label="QUANTUM WEIGHT"
            value={config.quantum_weight}
            onChange={(v: number) => setConfig({ ...config, quantum_weight: v })}
          />
        </div>
        <div className={`mt-6 p-3 rounded-2xl text-xs font-mono text-center border ${
          isValid ? 'bg-white/5 border-white/5 text-white/50' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          TOTAL: {totalWeight.toFixed(2)} {!isValid && '• Weights must sum to 1.00'}
        </div>
      </div>

      {/* Thresholds */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Risk Band Thresholds
        </h3>
        <div className="space-y-6">
          <Slider
            label="LOW THRESHOLD"
            value={config.low_threshold}
            onChange={(v: number) => setConfig({ ...config, low_threshold: v })}
            min={0}
            max={1}
            step={0.05}
          />
          <Slider
            label="MEDIUM THRESHOLD"
            value={config.medium_threshold}
            onChange={(v: number) => setConfig({ ...config, medium_threshold: v })}
            min={0}
            max={1}
            step={0.05}
          />
          <Slider
            label="HIGH THRESHOLD"
            value={config.high_threshold}
            onChange={(v: number) => setConfig({ ...config, high_threshold: v })}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
      </div>

      {/* Config Info */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-mono font-semibold text-white/30 uppercase tracking-wider mb-6">
          Configuration Metadata
        </h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-white/20 text-xs font-mono font-semibold uppercase mb-1">VERSION</div>
            <div className="font-mono text-white/60">{config.config_version}</div>
          </div>
          <div>
            <div className="text-white/20 text-xs font-mono font-semibold uppercase mb-1">CREATED BY</div>
            <div className="font-mono text-white/60">{config.created_by}</div>
          </div>
          <div className="col-span-2">
            <div className="text-white/20 text-xs font-mono font-semibold uppercase mb-1">CREATED AT</div>
            <div className="font-mono text-white/60">{new Date(config.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.1 }: any) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-3">
        <span className="font-mono font-semibold text-white/50">{label}</span>
        <span className="font-mono font-bold text-white/70">{value.toFixed(2)}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.3)]
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:hover:scale-125"
        />
        {/* Track fill */}
        <div
          className="absolute top-1/2 left-0 h-1 bg-white/20 rounded-full pointer-events-none -translate-y-1/2"
          style={{ width: `${((value - min) / (max - min)) * 100}%` }}
        />
      </div>
    </div>
  )
}
