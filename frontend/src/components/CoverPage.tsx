import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Shield, ArrowDown, Activity, Lock, Database, CheckCircle, Fingerprint, Globe, TrendingUp } from 'lucide-react'

export function CoverPage() {
  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  })
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.92])
  const opacity = useTransform(scrollYProgress, [0, 0.4], [1, 0])

  return (
    <motion.section
      ref={sectionRef}
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ scale, opacity }}
    >
      {/* Layered gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-black" />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-[500px] opacity-[0.02]"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, white 0%, transparent 70%)' }}
        />
      </div>

      {/* Grid lines background */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Content */}
      <motion.div className="relative z-10 text-center px-6 max-w-5xl mx-auto" style={{ opacity }}>
        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex justify-center gap-4 mb-10"
        >
          <TrustBadge icon={<Fingerprint className="w-3.5 h-3.5" />} label="SOC 2 Compliant" />
          <TrustBadge icon={<Globe className="w-3.5 h-3.5" />} label="ISO 27001" />
          <TrustBadge icon={<CheckCircle className="w-3.5 h-3.5" />} label="GDPR Ready" />
        </motion.div>

        {/* Shield */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.5, type: "spring", bounce: 0.3 }}
          className="mb-10"
        >
          <div className="inline-flex items-center justify-center relative">
            {/* Outer ring */}
            <motion.div
              className="absolute w-28 h-28 rounded-full border border-white/5"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/20 rounded-full" />
            </motion.div>
            {/* Inner ring */}
            <motion.div
              className="absolute w-20 h-20 rounded-full border border-white/8"
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            {/* Shield */}
            <div className="w-16 h-16 bg-white/5 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              >
                <Shield className="w-8 h-8 text-white/80" />
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-7xl md:text-[120px] font-semibold font-display tracking-tighter mb-6 leading-none"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          <span className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
            SENTINEL-Q
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-lg md:text-xl font-mono text-white/25 mb-14 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          Enterprise-Grade Fraud Detection &amp; Security Intelligence Platform
        </motion.p>

        {/* Feature cards */}
        <motion.div
          className="flex flex-wrap justify-center gap-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <FeatureCard icon={<Activity />} label="Real-time Detection" />
          <FeatureCard icon={<Lock />} label="Quantum Security" />
          <FeatureCard icon={<Database />} label="ML-powered Analysis" />
          <FeatureCard icon={<TrendingUp />} label="Predictive Analytics" />
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="flex flex-wrap justify-center gap-16 mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          <StatItem value="99.99%" label="Detection Accuracy" />
          <StatItem value="<5ms" label="Response Time" />
          <StatItem value="10M+" label="Transactions/Day" />
          <StatItem value="$2B+" label="Assets Protected" />
        </motion.div>

        {/* Scroll CTA */}
        <motion.button
          onClick={() => {
            document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="flex flex-col items-center gap-3 text-white/20 hover:text-white/50 transition-colors cursor-pointer group"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <span className="text-xs font-mono font-semibold tracking-[0.3em]">EXPLORE DASHBOARD</span>
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="group-hover:scale-110 transition-transform"
          >
            <ArrowDown className="w-6 h-6" />
          </motion.div>
        </motion.button>
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </motion.section>
  )
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm"
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <div className="text-white/30">{icon}</div>
      <span className="text-[10px] font-mono font-semibold text-white/25 tracking-wider">{label}</span>
    </motion.div>
  )
}

function FeatureCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4 p-7 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-sm cursor-pointer group min-w-[180px]"
      whileHover={{
        scale: 1.06,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.1)',
        y: -8,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <motion.div
        className="p-3 bg-white/5 rounded-xl border border-white/5 group-hover:bg-white/10 transition-all"
        whileHover={{ rotate: 360, scale: 1.1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="text-white/40 group-hover:text-white/70 transition-colors">{icon}</div>
      </motion.div>
      <span className="text-xs font-mono font-semibold text-white/25 group-hover:text-white/50 transition-colors tracking-wider">{label}</span>
    </motion.div>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <motion.div className="text-center">
      <div className="text-4xl font-semibold font-display bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="text-xs font-mono text-white/20 mt-2 tracking-wider">{label}</div>
    </motion.div>
  )
}
