import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Activity,
  BookOpen,
  History,
  Menu,
  Radio,
  Scale,
  ScanLine,
  Shield,
  Tv,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { CyberBackground } from './CyberBackground'

export type Page = 'scan' | 'feed' | 'broadcasts' | 'laws' | 'history' | 'analysis' | 'about'

export function Shell({
  page,
  onNavigate,
  health,
  children,
}: {
  page: Page
  onNavigate: (page: Page) => void
  health: boolean | null
  children: ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileNavigationRef = useRef<HTMLElement>(null)

  const links: [Page, string, typeof ScanLine][] = [
    ['scan', 'Scan', ScanLine],
    ['feed', 'ScamWatch Live', Radio],
    ['broadcasts', 'Scam Broadcasts', Tv],
    ['laws', 'India Cyber Law', Scale],
    ['history', 'History', History],
    ['analysis', 'Analysis', Activity],
    ['about', 'About', BookOpen],
  ]

  const handleNav = (target: Page) => {
    const wasMobileMenuOpen = mobileMenuOpen
    onNavigate(target)
    setMobileMenuOpen(false)
    if (wasMobileMenuOpen) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
  }

  const serviceState = health === true ? 'online' : health === false ? 'offline' : 'checking'

  useEffect(() => {
    if (!mobileMenuOpen) return

    mobileNavigationRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        window.requestAnimationFrame(() => menuButtonRef.current?.focus())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  return (
    <div className="app-shell">
      <CyberBackground />
      <header className="topbar">
        <button className="brand" onClick={() => handleNav('scan')} aria-label="VIGIL scan home">
          <motion.span
            className="brand-mark"
            initial={{ scale: 0.8, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Shield size={19} />
          </motion.span>
          <span className="brand-text">VIGIL</span>
        </button>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(([key, label, Icon]) => {
            const isActive = page === key
            return (
              <button
                className={`nav-btn ${isActive ? 'active' : ''}`}
                key={key}
                onClick={() => handleNav(key)}
              >
                {isActive && (
                  <motion.div
                    className="nav-active-pill"
                    layoutId="active-nav-pill"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon size={16} />
                <span>{label}</span>
                {key === 'feed' && <span className="nav-live-dot" title="Real-time live threat intelligence" />}
                {key === 'broadcasts' && <span className="nav-broadcast-beacon" title="Public scam awareness stream" />}
              </button>
            )
          })}
        </nav>

        <div className="topbar-right">
          <div
            className="service-state"
            aria-label={`Backend ${serviceState}`}
          >
            <span className={`state-dot ${serviceState}`}>
              <span className="state-ping" />
            </span>
            <span className="state-label">
              {serviceState === 'online' ? 'Service online' : serviceState === 'offline' ? 'Service offline' : 'Checking'}
            </span>
          </div>

          <button
            ref={menuButtonRef}
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-controls={mobileMenuOpen ? 'mobile-navigation' : undefined}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <motion.div
          className="mobile-nav-drawer"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <nav id="mobile-navigation" ref={mobileNavigationRef} aria-label="Mobile navigation">
            {links.map(([key, label, Icon]) => (
              <button
                className={`mobile-nav-btn ${page === key ? 'active' : ''}`}
                key={key}
                onClick={() => handleNav(key)}
                aria-current={page === key ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {key === 'feed' && <span className="nav-live-dot" aria-hidden="true" />}
                {key === 'broadcasts' && <span className="nav-broadcast-beacon" aria-hidden="true" />}
              </button>
            ))}
          </nav>
        </motion.div>
      )}

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-brand-title">VIGIL AI</span>
            <span className="footer-brand-sub">Autonomous Threat Intelligence & Cyber Protection Engine</span>
          </div>
          <div className="footer-links">
            <span>URL-Only Zero-Execution Analysis</span>
            <span className="footer-sep">•</span>
            <span>Public Incident Awareness</span>
            <span className="footer-sep">•</span>
            <span>India Cyber Law Knowledge</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
