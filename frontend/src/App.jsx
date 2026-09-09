import { useEffect, useState } from 'react'
import { register, login, getMe, deposit, sendPayment } from './api'

function AuthForm({ mode, onSuccess, onSwitchMode }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', currency: 'USD' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = mode === 'register' ? await register(form) : await login(form)
      onSuccess(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h1>{mode === 'register' ? 'Create account' : 'Log in'}</h1>
      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <input
            name="name"
            placeholder="Name"
            value={form.name}
            onChange={handleChange}
            required
          />
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />
        {mode === 'register' && (
          <select name="currency" value={form.currency} onChange={handleChange}>
            <option value="USD">USD</option>
          </select>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : mode === 'register' ? 'Register' : 'Log in'}
        </button>
      </form>
      <p className="switch-link" onClick={onSwitchMode}>
        {mode === 'register' ? 'Already have an account? Log in' : "Don't have an account? Register"}
      </p>
    </div>
  )
}

function Dashboard({ token, onLogout }) {
  const [account, setAccount] = useState(null)
  const [error, setError] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [payReceiver, setPayReceiver] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [busy, setBusy] = useState(false)

    const loadAccount = async () => {
    // Account creation happens asynchronously (via a Kafka event) right after
    // register/login, so it may not exist yet on the very first fetch.
    // Retry a few times with a short delay before giving up.
    const maxAttempts = 6
    const delayMs = 500

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const data = await getMe(token)
        setAccount(data)
        setError('')
        return
      } catch (err) {
        if (attempt === maxAttempts) {
          setError('Could not load account. Please refresh in a moment.')
        } else {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }
  }

  useEffect(() => {
    loadAccount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDeposit = async (e) => {
    e.preventDefault()
    setStatusMsg('')
    setBusy(true)
    try {
      const updated = await deposit(token, account.number, Number(depositAmount))
      setAccount(updated)
      setDepositAmount('')
      setStatusMsg('Deposit successful.')
    } catch (err) {
      setStatusMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    setStatusMsg('')
    setBusy(true)
    try {
      await sendPayment(token, account.number, payReceiver, Number(payAmount))
      setPayReceiver('')
      setPayAmount('')
      setStatusMsg('Payment sent successfully.')
      await loadAccount()
    } catch (err) {
      setStatusMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
        <button onClick={onLogout}>Back to login</button>
      </div>
    )
  }

  if (!account) {
    return <div className="card"><p>Loading account...</p></div>
  }

  return (
    <div className="card dashboard">
      <div className="dashboard-header">
        <div>
          <h1>{account.owner}</h1>
          <p className="account-number">{account.number}</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>Log out</button>
      </div>

      <div className="balance">
        <span>{account.currency}</span>
        <strong>{account.balance.toFixed(2)}</strong>
      </div>

      {statusMsg && <p className="status">{statusMsg}</p>}

      <div className="actions">
        <form onSubmit={handleDeposit} className="action-form">
          <h3>Deposit</h3>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>Deposit</button>
        </form>

        <form onSubmit={handleSend} className="action-form">
          <h3>Send money</h3>
          <input
            placeholder="Receiver account number"
            value={payReceiver}
            onChange={(e) => setPayReceiver(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>Send</button>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [authMode, setAuthMode] = useState('login')

  const handleAuthSuccess = (newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setAuthMode('login')
  }

  return (
    <div className="app-container">
      {token ? (
        <Dashboard token={token} onLogout={handleLogout} />
      ) : (
        <AuthForm
          mode={authMode}
          onSuccess={handleAuthSuccess}
          onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        />
      )}
    </div>
  )
}
