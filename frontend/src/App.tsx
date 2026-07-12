import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring, useTransform as useMotionTransform } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertQueue } from './components/AlertQueue'
import { CryptoPosture } from './components/CryptoPosture'
import { ConfigPanel } from './components/ConfigPanel'
import { ThreeBackground } from './components/ThreeBackground'
import { CoverPage } from './components/CoverPage'
import { LiveInput } from './components/LiveInput'
import { LoginPage } from './components/LoginPage'
import { Shield, Cpu, Activity, Database, Lock, RefreshCw, LogOut } from 'lucide-react'

function useCountUp(end: number, duration: number = 1.5) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!isInView) return
    let startTime: number | null = null
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(eased * end)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [isInView, end, duration])

  return { count, ref }
}

function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const { count, ref } = useCountUp(value, 1.8)
  return (
    <span ref={ref}>
      {count.toFixed(decimals)}{suffix}
    </span>
  )
}

function TiltCard({
  children,
  className = '',
  intensity = 8,
  disabled = false
}: {
  children: React.ReactNode
  className?: string
  intensity?: number
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useMotionTransform(y, [-0.5, 0.5], [intensity, -intensity]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useMotionTransform(x, [-0.5, 0.5], [-intensity, intensity]), { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    x.set(px)
    y.set(py)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  )
}

function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.left = `${e.clientX}px`
        glowRef.current.style.top = `${e.clientY}px`
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      ref={glowRef}
      className="fixed pointer-events-none z-[9998] -translate-x-1/2 -translate-y-1/2"
      style={{
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(229,229,229,0.03) 0%, transparent 70%)',
        transition: 'left 0.3s ease-out, top 0.3s ease-out',
      }}
    />
  )
}

function SkeletonLoader({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

function App() {
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { scrollYProgress } = useScroll()
  const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [0, 1])
  const headerY = useTransform(scrollYProgress, [0, 0.1], [-50, 0])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('auth_success')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { authenticated: false })
      .then(data => {
        if (data.authenticated) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const handleLogin = useCallback((userData: any) => {
    setUser(userData)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    setUser(null)
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Shield className="w-8 h-8 text-white/20" />
        </motion.div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <ThreeBackground />
        <LoginPage onLogin={handleLogin} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative noise-overlay">
      <ThreeBackground />
      <CursorGlow />

      <CoverPage />

      <motion.header
        style={{ opacity: headerOpacity, y: headerY }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl"
      >
        <div className="flex items-center gap-4">
          <motion.div
            className="p-3 bg-white/10 rounded-2xl border border-white/5"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Shield className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-semibold font-display tracking-tight">SENTINEL-Q</h1>
            <p className="text-xs font-mono text-white/40 uppercase tracking-widest mt-1">Fraud & Security Correlation</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <motion.div
            className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/5 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-2 h-2 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-xs font-mono font-semibold text-white/80">LIVE</span>
          </motion.div>
          <div className="flex items-center gap-2 text-xs font-mono text-white/30">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Cpu className="w-4 h-4" />
            </motion.div>
            <span>SYS: ONLINE</span>
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-white/5">
            <div className="text-xs font-mono text-white/30">{user.username}</div>
            <motion.button
              onClick={handleLogout}
              className="p-2 bg-white/5 rounded-full border border-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      <main className="relative z-10 pt-32 pb-24">
        <DashboardSection onRefresh={handleRefresh} />
        <LiveInputSection onRefresh={handleRefresh} />
        <AlertsSection refreshKey={refreshKey} />
        <CryptoSection />
        <ConfigSection />
      </main>
    </div>
  )
}

function DashboardSection({ onRefresh }: { onRefresh: () => void }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [-100, 100])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])

  return (
    <motion.section ref={ref} style={{ y, opacity }} className="min-h-screen px-6 py-12 relative">
      <Dashboard onRefresh={onRefresh} />
    </motion.section>
  )
}

function AlertsSection({ refreshKey }: { refreshKey: number }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [-80, 80])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])

  return (
    <motion.section ref={ref} style={{ y, opacity }} className="min-h-screen px-6 py-12 relative">
      <div className="mb-8">
        <h2 className="text-4xl font-semibold font-display tracking-tight mb-2">Alert Queue</h2>
        <p className="text-sm font-mono text-white/30">Real-time threat detection and analysis</p>
      </div>
      <AlertQueue onAlertSelect={() => {}} refreshKey={refreshKey} />
    </motion.section>
  )
}

function LiveInputSection({ onRefresh }: { onRefresh: () => void }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [-60, 60])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])

  return (
    <motion.section ref={ref} style={{ y, opacity }} className="min-h-screen px-6 py-12 relative flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="text-4xl font-semibold font-display tracking-tight mb-2">Live Ingestion</h2>
          <p className="text-sm font-mono text-white/30">Submit data and watch the scoring engine analyze it in real-time</p>
        </div>
        <LiveInput onNewData={onRefresh} />
      </div>
    </motion.section>
  )
}

function CryptoSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [-60, 60])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])

  return (
    <motion.section ref={ref} style={{ y, opacity }} className="min-h-screen px-6 py-12 relative">
      <CryptoPosture />
    </motion.section>
  )
}

function ConfigSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [-40, 40])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])

  return (
    <motion.section ref={ref} style={{ y, opacity }} className="min-h-screen px-6 py-12 relative">
      <ConfigPanel />
    </motion.section>
  )
}

function Dashboard({ onRefresh }: { onRefresh: () => void }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      setStats(data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 3000)
    return () => clearInterval(interval)
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={containerVariants}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold font-display tracking-tight">Global Event Matrix</h2>
          <p className="text-sm font-mono text-white/30 mt-2">Enterprise fraud detection network &bull; Real-time monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/5">
            <motion.div
              className="w-2 h-2 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-xs font-mono font-semibold text-white/80">LIVE</span>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-full border border-white/5">
            <span className="text-xs font-mono font-semibold text-white/40">ENCRYPTED</span>
          </div>
          <motion.button
            onClick={fetchStats}
            className="p-2 bg-white/10 rounded-full border border-white/5"
            whileHover={{ scale: 1.1, rotate: 180 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <RefreshCw className="w-4 h-4 text-white/60" />
          </motion.button>
        </div>
      </motion.div>

      {/* Update + Simulate */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        {lastUpdate && (
          <div className="text-xs font-mono text-white/20">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
        <motion.button
          onClick={async () => {
            try {
              await fetch('/api/simulate', { method: 'POST' })
              fetchStats()
              onRefresh()
            } catch (error) {
              console.error('Failed to simulate:', error)
            }
          }}
          className="px-5 py-2.5 bg-white/10 rounded-full text-xs font-mono font-semibold text-white/80 border border-white/5 hover:bg-white/15 transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          SIMULATE TRANSACTION
        </motion.button>
      </motion.div>

      {/* Metrics Grid */}
      <motion.div variants={itemVariants}>
        <TiltCard className="glass-card-light p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-black/5 rounded-[20px] p-5"><SkeletonLoader className="h-24" /></div>
              ))
            ) : (
              <>
                <MetricCard icon={<Activity className="w-5 h-5" />} label="Total Sessions" value={stats?.total_sessions || 0} change="+12%" />
                <MetricCard icon={<Database className="w-5 h-5" />} label="Total Alerts" value={stats?.total_alerts || 0} change="+23%" />
                <MetricCard icon={<Lock className="w-5 h-5" />} label="Open Alerts" value={stats?.open_alerts || 0} change="+0.3%" />
                <MetricCard icon={<Activity className="w-5 h-5" />} label="High Risk" value={stats?.risk_distribution?.high || 0} change="+45%" />
              </>
            )}
          </div>
        </TiltCard>
      </motion.div>

      {/* Capacity + Telemetry */}
      <motion.div variants={itemVariants}>
        <TiltCard className="glass-card-light p-6" intensity={4}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/5 rounded-[20px] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-black/10 rounded-xl">
                    <Database className="w-4 h-4 text-black/60" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-black/40 uppercase tracking-wider">Network Capacity</span>
                </div>
                <span className="text-3xl font-semibold font-display">
                  {loading ? '...' : <>{Math.round((stats?.total_sessions || 0) / 10000 * 100)}%</>}
                </span>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full bg-black/80 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: loading ? '0%' : `${Math.min((stats?.total_sessions || 0) / 10000 * 100, 100)}%` }}
                  transition={{ duration: 1.5, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-black/30">
                <span>0</span>
                <span>Current Load</span>
                <span>Max Capacity</span>
              </div>
            </div>
            <div className="bg-black/5 rounded-[20px] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-black/10 rounded-xl">
                  <Activity className="w-4 h-4 text-black/60" />
                </div>
                <span className="text-xs font-mono font-semibold text-black/40 uppercase tracking-wider">System Telemetry</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TelemetryItem label="Latency" value="12ms" status="optimal" />
                <TelemetryItem label="Packet Loss" value="0.01%" status="optimal" />
                <TelemetryItem label="Uptime" value="99.99%" status="optimal" />
                <TelemetryItem label="Error Rate" value="0.001%" status="optimal" />
              </div>
            </div>
          </div>
        </TiltCard>
      </motion.div>

      {/* Security Matrix */}
      <motion.div variants={itemVariants}>
        <TiltCard className="glass-card-light p-6" intensity={4}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-black/10 rounded-xl">
                <Lock className="w-4 h-4 text-black/60" />
              </div>
              <span className="text-xs font-mono font-semibold text-black/40 uppercase tracking-wider">Security Matrix Status</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/10 rounded-full">
              <motion.div
                className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[10px] font-mono font-semibold text-black/60">ALL SYSTEMS SECURE</span>
            </div>
          </div>
          <div className="bg-black/5 rounded-[20px] p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['US-EAST', 'EU-WEST', 'AP-SOUTH', 'SA-EAST'].map((region, i) => (
                <motion.div
                  key={region}
                  className="bg-black/5 rounded-[16px] p-4 text-center cursor-pointer border border-black/5 hover:border-black/10 transition-all"
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <div className="text-[10px] font-mono text-black/40 mb-2">{region}</div>
                  <div className="text-2xl font-semibold font-display">{['98%', '99%', '97%', '100%'][i]}</div>
                  <div className="text-[10px] font-mono text-emerald-600 mt-1">SECURE</div>
                </motion.div>
              ))}
            </div>
          </div>
        </TiltCard>
      </motion.div>

      {/* Transaction Volume Chart */}
      <motion.div variants={itemVariants}>
        <TiltCard className="glass-card-light p-6" intensity={3}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-black/10 rounded-xl">
                <Database className="w-4 h-4 text-black/60" />
              </div>
              <span className="text-xs font-mono font-semibold text-black/40 uppercase tracking-wider">Transaction Volume Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              {['24H', '7D', '30D'].map((period, i) => (
                <div key={period} className={`px-3 py-1.5 rounded-full ${i === 0 ? 'bg-black/10' : 'bg-black/5'} border border-black/5`}>
                  <span className={`text-[10px] font-mono font-semibold ${i === 0 ? 'text-black/80' : 'text-black/30'}`}>{period}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-black/5 rounded-[20px] p-6">
            <TransactionChart />
          </div>
        </TiltCard>
      </motion.div>
    </motion.div>
  )
}

function MetricCard({ icon, label, value, change }: { icon: React.ReactNode; label: string; value: number; change: string }) {
  return (
    <motion.div
      className="bg-black/5 rounded-[20px] p-5 relative overflow-hidden border border-black/5 hover:border-black/10 transition-all"
      whileHover={{ scale: 1.03, y: -5 }}
      transition={{ type: "spring", stiffness: 400 }}
    >
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-black/10 rounded-xl">{icon}</div>
          <span className="text-[10px] font-mono font-semibold text-black/40 uppercase">{label}</span>
        </div>
        <div className="text-4xl font-semibold font-display mb-2">
          <AnimatedNumber value={value} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          <span className="text-xs font-mono text-emerald-600">{change}</span>
        </div>
      </div>
    </motion.div>
  )
}

function TelemetryItem({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="bg-black/5 rounded-[16px] p-4 border border-black/5">
      <div className="text-[10px] font-mono text-black/30 mb-1">{label}</div>
      <div className="text-2xl font-semibold font-display">{value}</div>
      <div className="text-[10px] font-mono text-emerald-600 mt-1">{status.toUpperCase()}</div>
    </div>
  )
}

function TransactionChart() {
  const chartData = useMemo(() => [
    { time: '00:00', transactions: 45, risk: 12 },
    { time: '03:00', transactions: 32, risk: 8 },
    { time: '06:00', transactions: 28, risk: 15 },
    { time: '09:00', transactions: 78, risk: 22 },
    { time: '12:00', transactions: 95, risk: 35 },
    { time: '15:00', transactions: 88, risk: 28 },
    { time: '18:00', transactions: 82, risk: 18 },
    { time: '21:00', transactions: 65, risk: 14 },
    { time: '24:00', transactions: 55, risk: 10 },
  ], [])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null
    return (
      <div className="bg-black/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
        <div className="text-xs font-mono text-white/40 mb-2">{label}</div>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-white/60">{entry.name}:</span>
            <span className="font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#000000" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#000000" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'rgba(0,0,0,0.3)' }}
            axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'rgba(0,0,0,0.3)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="transactions"
            name="Transactions"
            stroke="#000000"
            strokeWidth={2}
            fill="url(#gradTx)"
            dot={false}
            activeDot={{ r: 4, fill: '#000000', stroke: '#fff', strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="risk"
            name="Risk Events"
            stroke="#EF4444"
            strokeWidth={1.5}
            fill="url(#gradRisk)"
            dot={false}
            activeDot={{ r: 3, fill: '#EF4444', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default App
