import { useState, useEffect, useRef } from 'react'
import { hapticLight, hapticSuccess } from '../lib/haptics.js'
import { t } from '../lib/i18n.js'

export default function SplashScreen({ ready = false, onFinish }) {
  const [progress, setProgress] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [statusText, setStatusText] = useState(t('Iniciando openGym...'))
  const finishedRef = useRef(false)

  // Smooth cinematic progress counter
  useEffect(() => {
    let current = 0
    const interval = setInterval(() => {
      if (finishedRef.current) return

      // Ramp faster if store is already ready
      const step = ready ? (current < 80 ? 4 : 7) : (current < 75 ? 2.5 : 0.8)
      current = Math.min(ready ? 100 : 92, current + step)
      setProgress(Math.floor(current))

      if (current < 30) {
        setStatusText(t('Iniciando openGym...'))
      } else if (current < 65) {
        setStatusText(t('Carregando treinos e rotinas...'))
      } else if (current < 90) {
        setStatusText(t('Preparando evolução...'))
      } else {
        setStatusText(t('Tudo pronto! Bora treinar.'))
      }

      if (current >= 100) {
        clearInterval(interval)
        triggerExit()
      }
    }, 45)

    return () => clearInterval(interval)
  }, [ready])

  // Watch for ready state completing
  useEffect(() => {
    if (ready && progress >= 85 && !finishedRef.current) {
      setProgress(100)
      setStatusText(t('Tudo pronto! Bora treinar.'))
      const timer = setTimeout(triggerExit, 250)
      return () => clearTimeout(timer)
    }
  }, [ready, progress])

  const triggerExit = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    setExiting(true)
    hapticSuccess()
    setTimeout(() => {
      onFinish?.()
    }, 450)
  }

  // Tap-to-skip so user is never blocked
  const handleTap = () => {
    if (!finishedRef.current && progress > 30) {
      hapticLight()
      setProgress(100)
      triggerExit()
    }
  }

  return (
    <div
      className={`splash-container ${exiting ? 'splash-exit' : ''}`}
      onClick={handleTap}
      aria-label="Splash Screen"
      role="presentation"
    >
      {/* Background ambient lighting */}
      <div className="splash-ambient-glow" />
      <div className="splash-ambient-secondary" />

      {/* Main hero card */}
      <div className="splash-content">
        {/* Animated Brand Emblem */}
        <div className="splash-logo-wrap">
          {/* Pulsing radar rings */}
          <div className="splash-pulse-ring r1" />
          <div className="splash-pulse-ring r2" />
          <div className="splash-pulse-ring r3" />

          {/* Central Logo Hex Badge */}
          <div className="splash-badge">
            <svg
              className="splash-svg"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="gymGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="45%" stopColor="var(--acc)" />
                  <stop offset="100%" stopColor="var(--acc-2, var(--acc))" />
                </linearGradient>
                <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Hexagon Shield outline */}
              <polygon
                points="50,6 88,26 88,74 50,94 12,74 12,26"
                className="splash-hex-path"
                stroke="url(#gymGlow)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Modern Barbell Emblem */}
              <g className="splash-dumbbell-group" filter="url(#neonBlur)">
                {/* Center Bar */}
                <line x1="28" y1="50" x2="72" y2="50" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                {/* Inner collars */}
                <line x1="36" y1="42" x2="36" y2="58" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" />
                <line x1="64" y1="42" x2="64" y2="58" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" />
                {/* Large outer plates */}
                <rect x="26" y="34" width="7" height="32" rx="3.5" fill="url(#gymGlow)" />
                <rect x="67" y="34" width="7" height="32" rx="3.5" fill="url(#gymGlow)" />
                {/* Second tier plates */}
                <rect x="20" y="39" width="4.5" height="22" rx="2.2" fill="var(--acc)" opacity="0.85" />
                <rect x="75.5" y="39" width="4.5" height="22" rx="2.2" fill="var(--acc)" opacity="0.85" />
                {/* Outer lock rings */}
                <circle cx="16.5" cy="50" r="2.2" fill="#ffffff" />
                <circle cx="83.5" cy="50" r="2.2" fill="#ffffff" />
              </g>

              {/* Energy Sparks */}
              <path d="M50 20 L51.5 25 L56 26.5 L51.5 28 L50 33 L48.5 28 L44 26.5 L48.5 25 Z" fill="var(--acc)" className="splash-sparkle s1" />
              <path d="M50 67 L51.5 72 L56 73.5 L51.5 75 L50 80 L48.5 75 L44 73.5 L48.5 72 Z" fill="var(--acc)" className="splash-sparkle s2" />
            </svg>
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="splash-brand">
          <h1 className="splash-title">
            <span className="splash-title-open">open</span>
            <span className="splash-title-gym">Gym</span>
          </h1>
          <p className="splash-tagline">
            {t('Treine com consistência • Evolua sempre')}
          </p>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="splash-progress-section">
          <div className="splash-progress-track">
            <div
              className="splash-progress-fill"
              style={{ width: `${progress}%` }}
            />
            <div
              className="splash-progress-glow"
              style={{ left: `${progress}%` }}
            />
          </div>

          <div className="splash-status-row">
            <span className="splash-status-label">{statusText}</span>
            <span className="splash-status-pct">{progress}%</span>
          </div>
        </div>

        {/* Subtle tap to skip hint */}
        <div className="splash-skip-hint">
          <span>{t('Toque para iniciar')}</span>
        </div>
      </div>
    </div>
  )
}
