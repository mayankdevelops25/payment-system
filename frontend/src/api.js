const BASE_URL = 'http://localhost:8090/api/v1'

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

function idempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function parseOrThrow(res, fallbackMessage) {
  let data = null
  try {
    data = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    throw new Error((data && data.message) || fallbackMessage)
  }
  return data
}

export async function register({ name, email, password, currency }) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, currency }),
  })
  return parseOrThrow(res, 'Registration failed')
}

export async function login({ email, password }) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return parseOrThrow(res, 'Login failed')
}

export async function getMe(token) {
  const res = await fetch(`${BASE_URL}/accounts/me`, {
    headers: authHeaders(token),
  })
  return parseOrThrow(res, 'Could not load account')
}

export async function deposit(token, accountNumber, amount) {
  const res = await fetch(`${BASE_URL}/accounts/${accountNumber}/deposit`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey('dep'),
    },
    body: JSON.stringify({ amount }),
  })
  return parseOrThrow(res, 'Deposit failed')
}

export async function sendPayment(token, sender, receiver, amount) {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey('pay'),
    },
    body: JSON.stringify({ sender, receiver, amount }),
  })
  const data = await parseOrThrow(res, 'Payment failed')
  if (data.status !== 'SUCCESS') {
    throw new Error(data.message || 'Payment failed')
  }
  return data
}
