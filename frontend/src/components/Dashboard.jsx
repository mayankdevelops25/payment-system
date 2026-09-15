import { useEffect, useMemo, useRef, useState } from 'react'
import { useCountUp } from '../hooks'
import * as api from '../api'
import {
  BoltIcon,
  LogOutIcon,
  PlusIcon,
  SendIcon,
  CopyIcon,
  CheckIcon,
  WalletIcon,
  RefreshIcon,
  AlertIcon,
  ShieldIcon,
  TrendUpIcon,
} from './Icons'
import {
  formatMoney,
  currencySymbol,
  timeGreeting,
  todayLabel,
  isNetworkError,
} from '../utils'
import BankCard from './BankCard'

const QUICK_AMOUNTS = [10, 50, 100, 500]

export default function Dashboard({ token, onLogout, toast }) {
  const [account, setAccount] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [depositAmount, setDepositAmount] = useState('')
  const [payReceiver, setPayReceiver] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [busyDeposit, setBusyDeposit] = useState(false)
  const [busySend, setBusySend] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(0)

  const loadAccount = async () => {
    // Account creation happens asynchronously (via a Kafka event) right after
    // register/login, so it may not exist yet on the very first fetch.
    // Retry a few times with a short delay before giving up.
    const maxAttempts = 6
    const delayMs = 500

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const data = await api.getMe(token)
        setAccount(data)
        setError('')
        return
      } catch (err) {
        if (attempt === maxAttempts || isNetworkError(err)) {
          setError(
            isNetworkError(err)
              ? 'Lost connection to the payment gateway.'
              : 'Could not load your account. It may still be provisioning — try again in a moment.'
          )
        } else {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      await loadAccount()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  const handleDeposit = async (e) => {
    e.preventDefault()
    setBusyDeposit(true)
    try {
      const updated = await api.deposit(token, account.number, Number(depositAmount))
      setAccount(updated)
      setDepositAmount('')
      toast(`Deposited ${formatMoney(Number(depositAmount), account.currency)} successfully.`, 'success')
    } catch (err) {
      toast(err.message || 'Deposit failed', 'error')
    } finally {
      setBusyDeposit(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    setBusySend(true)
    try {
      await api.sendPayment(token, account.number, payReceiver, Number(payAmount))
      toast(`Sent ${formatMoney(Number(payAmount), account.currency)} to ${payReceiver}.`, 'success')
      setPayReceiver('')
      setPayAmount('')
      const updated = await api.getMe(token)
      setAccount(updated)
    } catch (err) {
      toast(err.message || 'Payment failed', 'error')
    } finally {
      setBusySend(false)
    }
  }

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(String(account.number))
      setCopied(true)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  const currency = account?.currency ?? 'USD'
  const symbol = currencySymbol(currency)

  const depositValue = parseFloat(depositAmount)
  const depositPreview =
    account && Number.isFinite(depositValue) && depositValue > 0
      ? account.balance + depositValue
      : null

  const payValue = parseFloat(payAmount)
  const payPreview =
    account && Number.isFinite(payValue) && payValue > 0 ? account.balance - payValue : null
  const insufficient = payPreview !== null && payPreview < 0
  const payingSelf =
    payValue > 0 && String(payReceiver).trim() === String(account?.number ?? '').trim()

  const displayName = useMemo(
    () => (account ? account.owner.split(' ')[0] : ''),
    [account]
  )

  const animatedBalance = useCountUp(account ? Number(account.balance) : 0)

  /* ---------- Load error (checked first: while there's an error the
         account is still null, so the skeleton must not win) ---------- */
  if (error) {
    return (
      <div className="dash-wrap">
        <div className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <BoltIcon size={18} />
            </span>
            <span className="brand-name">Payment System</span>
          </div>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            <LogOutIcon size={16} />
            Log out
          </button>
        </div>
        <div className="error-card">
          <span className="error-card-icon">
            <AlertIcon size={26} />
          </span>
          <h2>Couldn't load your account</h2>
          <p>{error}</p>
          <div className="error-card-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                setError('')
                setLoading(true)
                await loadAccount()
                setLoading(false)
              }}
            >
              <RefreshIcon size={16} />
              Try again
            </button>
            <button type="button" className="btn-ghost" onClick={onLogout}>
              <LogOutIcon size={16} />
              Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Loading skeleton ---------- */
  if (loading || !account) {
    return (
      <div className="dash-wrap">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <BoltIcon size={18} />
            </span>
            <span className="brand-name">Payment System</span>
          </div>
        </header>
        <main className="dash-main">
          <div className="skeleton sk-greet" />
          <div className="dash-grid">
            <div className="skeleton sk-card" />
            <div className="panel" aria-label="Loading account">
              <div className="skeleton sk-line sm" />
              <div className="skeleton sk-line lg" />
              <div className="skeleton sk-line" />
              <div className="skeleton sk-line sm" />
            </div>
          </div>
          <div className="actions-grid">
            <div className="skeleton sk-action" />
            <div className="skeleton sk-action" />
          </div>
        </main>
      </div>
    )
  }

  /* ---------- Main dashboard ---------- */
  return (
    <div className="dash-wrap">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <BoltIcon size={18} />
          </span>
          <span className="brand-name">Payment System</span>
        </div>
        <div className="topbar-right">
          <button type="button" className="btn-ghost" onClick={onLogout}>
            <LogOutIcon size={16} />
            Log out
          </button>
        </div>
      </header>

      <main className="dash-main">
        <div className="greeting">
          <h1>
            {timeGreeting()}, <span className="grad-text">{displayName || 'there'}</span>
          </h1>
          <p>{todayLabel()}</p>
        </div>

        <div className="dash-grid">
          <BankCard account={account} />

          <section className="panel stats-panel" aria-label="Account summary">
            <div className="stats-balance">
              <span className="stats-label">
                <TrendUpIcon size={15} />
                Current balance
              </span>
              <span className="balance-amount">
                {formatMoney(animatedBalance, currency)}
              </span>
              <span className="stats-currency">{currency}</span>
            </div>

            <div className="stats-rows">
              <div className="stat-row">
                <span className="stat-row-label">Account number</span>
                <span className="stat-row-value">
                  <code className="account-mono">{account.number}</code>
                  <button
                    type="button"
                    className={`icon-btn ${copied ? 'copied' : ''}`}
                    onClick={copyAccountNumber}
                    aria-label="Copy account number"
                    title="Copy account number"
                  >
                    {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                  </button>
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-row-label">Currency</span>
                <span className="stat-row-value">
                  <span className="currency-chip">{currency}</span>
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="actions-grid">
          {/* ---------- Deposit ---------- */}
          <form className="panel action-card" onSubmit={handleDeposit}>
            <div className="action-head">
              <span className="action-icon deposit-tint">
                <PlusIcon size={18} />
              </span>
              <div>
                <h3>Deposit</h3>
                <p>Add funds to your balance</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="deposit-amount">Amount</label>
              <div className="amount-wrap">
                <span className="amount-prefix">{symbol}</span>
                <input
                  id="deposit-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="chips" aria-label="Quick amounts">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`chip ${depositAmount === String(amt) ? 'active' : ''}`}
                  onClick={() =>
                    setDepositAmount(depositAmount === String(amt) ? '' : String(amt))
                  }
                >
                  +{symbol}
                  {amt}
                </button>
              ))}
            </div>

            <div className={`preview ${depositPreview !== null ? '' : 'muted'}`}>
              <span>New balance</span>
              <strong>{depositPreview !== null ? formatMoney(depositPreview, currency) : '—'}</strong>
            </div>

            <button type="submit" className="btn-primary" disabled={busyDeposit}>
              {busyDeposit ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Processing…
                </>
              ) : (
                <>
                  <WalletIcon size={17} />
                  Add funds
                </>
              )}
            </button>
          </form>

          {/* ---------- Send money ---------- */}
          <form className="panel action-card" onSubmit={handleSend}>
            <div className="action-head">
              <span className="action-icon send-tint">
                <SendIcon size={18} />
              </span>
              <div>
                <h3>Send money</h3>
                <p>Transfer to any account number</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="pay-receiver">Receiver account number</label>
              <div className="amount-wrap">
                <span className="amount-prefix flat">
                  <WalletIcon size={16} />
                </span>
                <input
                  id="pay-receiver"
                  type="text"
                  inputMode="numeric"
                  placeholder="Receiver account number"
                  value={payReceiver}
                  onChange={(e) => setPayReceiver(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="pay-amount">Amount</label>
              <div className="amount-wrap">
                <span className="amount-prefix">{symbol}</span>
                <input
                  id="pay-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="chips" aria-label="Quick amounts">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`chip ${payAmount === String(amt) ? 'active' : ''}`}
                  onClick={() => setPayAmount(payAmount === String(amt) ? '' : String(amt))}
                >
                  {symbol}
                  {amt}
                </button>
              ))}
            </div>

            <div className={`preview ${insufficient || payingSelf ? 'warn' : payPreview !== null ? '' : 'muted'}`}>
              <span className="preview-label">
                {payingSelf ? (
                  <>
                    <AlertIcon size={14} />
                    You can't send to your own account
                  </>
                ) : insufficient ? (
                  <>
                    <AlertIcon size={14} />
                    Insufficient balance by {formatMoney(Math.abs(payPreview), currency)}
                  </>
                ) : (
                  'New balance'
                )}
              </span>
              <strong>
                {payingSelf || insufficient ? '—' : payPreview !== null ? formatMoney(payPreview, currency) : '—'}
              </strong>
            </div>

            <button
              type="submit"
              className={`btn-primary ${insufficient || payingSelf ? 'btn-blocked' : ''}`}
              disabled={busySend}
            >
              {busySend ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  <SendIcon size={16} />
                  Send money
                </>
              )}
            </button>
          </form>
        </div>

        <p className="dash-footnote">
          <ShieldIcon size={13} />
          Every request is idempotent, and transfers are automatically sent for fraud review.
        </p>
      </main>
    </div>
  )
}
