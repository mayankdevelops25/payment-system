import { useState } from 'react'
import {
  BoltIcon,
  MailIcon,
  LockIcon,
  UserIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldIcon,
  SendIcon,
  WalletIcon,
  ArrowRightIcon,
  AlertIcon,
} from './Icons'

const FEATURES = [
  {
    icon: ShieldIcon,
    title: 'Fraud-safe by design',
    sub: 'Every transfer passes a real-time rule engine before it settles.',
  },
  {
    icon: SendIcon,
    title: 'Instant P2P transfers',
    sub: 'Money moves in milliseconds — and never twice (idempotent by default).',
  },
  {
    icon: WalletIcon,
    title: 'Deposits & accounts',
    sub: 'Top up your balance and track it live as it changes.',
  },
]

const PROOF_CHIPS = [
  { label: 'Fraud blocked', value: '$2,450.00' },
  { label: 'Median settlement', value: '12 ms' },
  { label: 'Uptime', value: '99.99%' },
]

export default function AuthScreen({ mode, onSubmit, onSwitchMode }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', currency: 'USD' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit(form, mode)
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const switchMode = () => {
    setError('')
    onSwitchMode(isRegister ? 'login' : 'register')
  }

  return (
    <div className="auth-layout">
      {/* ---------- Brand panel (desktop) ---------- */}
      <aside className="auth-brand">
        <div className="brand">
          <span className="brand-mark">
            <BoltIcon size={18} />
          </span>
          <span className="brand-name">Payment System</span>
        </div>

        <div>
          <h1 className="auth-headline">
            Move money with <span className="grad-text">confidence</span>.
          </h1>
          <p className="auth-sub">
            Instant peer-to-peer transfers, one-tap deposits and a fraud engine
            that never blinks — wrapped in an interface that stays out of your way.
          </p>
        </div>

        <ul className="feature-list">
          {FEATURES.map(({ icon: Icon, title, sub }) => (
            <li key={title} className="feature-item">
              <span className="feature-icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                <span>{sub}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="proof-chips">
          {PROOF_CHIPS.map((c) => (
            <div key={c.label} className="proof-chip">
              <strong>{c.value}</strong>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ---------- Form panel ---------- */}
      <main className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-mobile-brand">
            <span className="brand-mark">
              <BoltIcon size={18} />
            </span>
            <span className="brand-name">Payment System</span>
          </div>

          <div className="seg" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? 'active' : ''}
              onClick={() => !isRegister || switchMode()}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? 'active' : ''}
              onClick={() => (isRegister || switchMode())}
            >
              Register
            </button>
          </div>

          <div className="auth-head-block">
            <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
            <p>
              {isRegister
                ? 'Open a balance in seconds — no paperwork, no waiting.'
                : 'Log in to view your balance and move money.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <span className="field-icon">
                  <UserIcon size={17} />
                </span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Alex Morgan"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email</label>
              <span className="field-icon">
                <MailIcon size={17} />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <span className="field-icon">
                <LockIcon size={17} />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={isRegister ? 'Pick a strong password' : 'Your password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={handleChange}
                required
                minLength={1}
              />
              <button
                type="button"
                className="field-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
              </button>
            </div>

            {isRegister && (
              <div className="field">
                <label htmlFor="currency">Currency</label>
                <span className="field-icon">
                  <WalletIcon size={17} />
                </span>
                <select
                  id="currency"
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  className="select"
                >
                  <option value="USD">USD — US Dollar</option>
                </select>
              </div>
            )}

            {error && (
              <div className="alert" role="alert">
                <span className="alert-icon">
                  <AlertIcon size={16} />
                </span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  {isRegister ? 'Creating account…' : 'Logging in…'}
                </>
              ) : (
                <>
                  {isRegister ? 'Create account' : 'Log in'}
                  <ArrowRightIcon size={17} />
                </>
              )}
            </button>
          </form>

          <p className="switch-link">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" onClick={switchMode}>
              {isRegister ? 'Log in' : 'Register'}
            </button>
          </p>
        </div>

        <p className="auth-footnote">
          <ShieldIcon size={13} />
          Secured with JWT authentication &amp; idempotent operations
        </p>
      </main>
    </div>
  )
}
