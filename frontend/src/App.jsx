import { useCallback, useRef, useState } from 'react'
import * as api from './api'
import AuthScreen from './components/AuthScreen'
import Dashboard from './components/Dashboard'
import Toasts from './components/Toasts'

// One-time cleanup: earlier builds stored a demo-mode flag that no longer exists.
if (typeof window !== 'undefined') {
  localStorage.removeItem('payment-system-demo')
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [authMode, setAuthMode] = useState('login')
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const pushToast = useCallback((message, type = 'success') => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-3), { id, message, type }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const handleAuth = useCallback(async (form, mode) => {
    let data
    try {
      data = mode === 'register' ? await api.register(form) : await api.login(form)
    } catch (err) {
      // A rejected fetch() means the gateway is unreachable — say so plainly.
      if (err instanceof TypeError) {
        throw new Error('Cannot reach the payment gateway. Make sure the backend is running.')
      }
      throw err
    }
    localStorage.setItem('token', data.token)
    setToken(data.token)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setAuthMode('login')
  }, [])

  return (
    <div className="app-shell">
      <div className="bg-grid" aria-hidden="true" />

      {token ? (
        <Dashboard token={token} onLogout={handleLogout} toast={pushToast} />
      ) : (
        <AuthScreen
          mode={authMode}
          onSubmit={handleAuth}
          onSwitchMode={setAuthMode}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
