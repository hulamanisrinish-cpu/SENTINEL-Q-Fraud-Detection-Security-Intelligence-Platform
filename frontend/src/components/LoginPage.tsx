import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  )
}

export function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => setMounted(true), [])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setMousePos({ x: px, y: py })
  }

  const handleMouseLeave = () => setMousePos({ x: 0, y: 0 })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error || 'Login failed')
        return
      }
      onLogin(data.user)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = (provider: 'google' | 'microsoft') => {
    window.location.href = `/api/auth/${provider}`
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/[0.03]"
            style={{
              width: Math.random() * 300 + 50,
              height: Math.random() * 300 + 50,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50, 0],
              y: [0, Math.random() * 100 - 50, 0],
              scale: [1, 1 + Math.random() * 0.3, 1],
            }}
            transition={{
              duration: Math.random() * 20 + 15,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Login Card */}
      <motion.div
        ref={cardRef}
        className="relative z-10 w-full max-w-md mx-4"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 40, scale: mounted ? 1 : 0.95 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          perspective: 1200,
          transform: `rotateX(${mousePos.y * -6}deg) rotateY(${mousePos.x * 6}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Glow behind card */}
        <div className="absolute -inset-1 rounded-[28px] opacity-30 blur-xl" style={{
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.06), transparent 70%)',
        }} />

        {/* Card */}
        <div className="relative rounded-[24px] border border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl overflow-hidden">
          {/* Top edge highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Inner glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-40 rounded-full opacity-[0.04] blur-3xl bg-white" />

          <div className="p-10">
            {/* Shield logo */}
            <motion.div
              className="flex justify-center mb-8"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, type: 'spring', bounce: 0.4 }}
            >
              <div className="relative">
                <motion.div
                  className="absolute -inset-3 rounded-full border border-white/[0.04]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/20 rounded-full" />
                </motion.div>
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center backdrop-blur-sm">
                  <Shield className="w-8 h-8 text-white/60" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-2xl font-semibold font-display tracking-tight text-white/90 mb-1">
                SENTINEL-Q
              </h1>
              <p className="text-xs font-mono text-white/25 tracking-[0.2em] uppercase">
                Secure Access Portal
              </p>
            </motion.div>

            {/* OAuth Buttons */}
            <motion.div
              className="space-y-3 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.button
                onClick={() => handleOAuth('google')}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] text-white/70 text-sm font-medium transition-all"
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                whileTap={{ scale: 0.98 }}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </motion.button>

              <motion.button
                onClick={() => handleOAuth('microsoft')}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] text-white/70 text-sm font-medium transition-all"
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                whileTap={{ scale: 0.98 }}
              >
                <MicrosoftIcon />
                <span>Continue with Microsoft</span>
              </motion.button>
            </motion.div>

            {/* Divider */}
            <motion.div
              className="flex items-center gap-4 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] font-mono text-white/20 tracking-widest uppercase">or sign in with email</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </motion.div>

            {/* Email/Password Form */}
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              {/* Email */}
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/40 transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@sentinel-q.io"
                  required
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white/80 text-sm font-mono placeholder:text-white/15 focus:outline-none focus:border-white/[0.12] focus:bg-white/[0.05] transition-all"
                />
              </div>

              {/* Password */}
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/40 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white/80 text-sm font-mono placeholder:text-white/15 focus:outline-none focus:border-white/[0.12] focus:bg-white/[0.05] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white text-black text-sm font-semibold transition-all disabled:opacity-50"
                whileHover={{ scale: loading ? 1 : 1.02, boxShadow: '0 0 30px rgba(255,255,255,0.15)' }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </motion.form>

            {/* Footer */}
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <p className="text-[10px] font-mono text-white/15 leading-relaxed">
                Protected by enterprise-grade encryption
                <br />
                SOC 2 &middot; ISO 27001 &middot; GDPR Compliant
              </p>
            </motion.div>
          </div>

          {/* Bottom edge highlight */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>
      </motion.div>
    </div>
  )
}
