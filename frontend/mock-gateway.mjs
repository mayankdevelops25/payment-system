// ---------------------------------------------------------------------------
// mock-gateway.mjs — zero-dependency dev stand-in for the API gateway
// (Spring Cloud Gateway + auth-service + payment-service).
//
// It implements the same /api/v1 contract the Java stack exposes — same
// endpoints, response shapes, status codes, error messages, idempotency
// replay, and the "account is created asynchronously after auth" behavior.
// It listens on 127.0.0.1:8090, the same port the real gateway uses, so the
// frontend (via the Vite /api proxy) works identically against either.
//
// State is in-memory: restarting the process resets users and balances.
//
//   node mock-gateway.mjs
// ---------------------------------------------------------------------------

import http from 'node:http'
import crypto from 'node:crypto'

const PORT = 8090

/** @type {Map<string, {name:string, email:string, password:string, userId:string, accountNumber:string|null, accountPromise:Promise<void>}>} */
const usersByEmail = new Map()
/** @type {Map<string, {owner:string, number:string, balance:number, currency:string, createdAt:string, userId:string}>} */
const accountsByNumber = new Map()
/** @type {Map<string, string>} token -> userId */
const tokens = new Map()
/** @type {Map<string, {status:number, body:unknown}>} idempotency-key -> recorded result */
const idempotency = new Map()
const transactions = []

const json = (res, status, body) => {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(payload)
}

const newToken = (userId) => {
  const token = crypto.randomBytes(24).toString('hex')
  tokens.set(token, userId)
  return token
}

const accountResponse = (a) => ({
  owner: a.owner,
  number: a.number,
  balance: a.balance,
  currency: a.currency,
  createdAt: a.createdAt,
})

const unauthorized = (res) => json(res, 401, { message: 'Unauthorized' })

function userFromAuthHeader(res, authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '')
  const userId = tokens.get(token)
  if (!userId) return null
  for (const u of usersByEmail.values()) if (u.userId === userId) return u
  return null
}

// Mirrors the async account creation that happens via the Kafka
// UserRegisteredEvent in the real stack: /accounts/me 404s briefly after
// login/register until the account exists (the frontend retries).
function provisionAccount(user) {
  user.accountPromise = new Promise((resolve) => {
    setTimeout(() => {
      const number =
        '1' + Array.from({ length: 15 }, () => crypto.randomInt(10)).join('')
      const account = {
        owner: user.name,
        number,
        balance: 0,
        currency: 'USD',
        createdAt: new Date().toISOString(),
        userId: user.userId,
      }
      accountsByNumber.set(number, account)
      user.accountNumber = number
      resolve()
    }, 400)
  })
}

async function handleRegister(res, body) {
  const { name, email, password, currency = 'USD' } = body || {}
  if (!name || !email || !password) {
    return json(res, 400, { message: 'Name, email and password are required' })
  }
  if (usersByEmail.has(email)) {
    return json(res, 409, { message: 'Email already registered' })
  }
  const user = {
    name,
    email,
    password,
    userId: crypto.randomUUID(),
    accountNumber: null,
    accountPromise: null,
  }
  usersByEmail.set(email, user)
  provisionAccount(user)
  json(res, 200, { token: newToken(user.userId), expiresIn: 86400 })
}

async function handleLogin(res, body) {
  const { email, password } = body || {}
  const user = usersByEmail.get(email)
  if (!user || user.password !== password) {
    return json(res, 401, { message: 'Invalid email or password' })
  }
  json(res, 200, { token: newToken(user.userId), expiresIn: 86400 })
}

async function handleGetMe(res, authHeader) {
  const user = userFromAuthHeader(res, authHeader)
  if (!user) return unauthorized(res)
  if (!user.accountNumber) {
    return json(res, 404, { message: 'Account not found' })
  }
  json(res, 200, accountResponse(accountsByNumber.get(user.accountNumber)))
}

async function handleDeposit(res, authHeader, idempotencyKey, accountNumber, body) {
  const user = userFromAuthHeader(res, authHeader)
  if (!user) return unauthorized(res)

  const replay = idempotencyKey ? idempotency.get(idempotencyKey) : undefined
  if (replay) return json(res, 200, replay.body)

  const account = accountsByNumber.get(String(accountNumber))
  if (!account) return json(res, 404, { message: 'Account not found' })
  if (account.userId !== user.userId) {
    return json(res, 403, { message: 'Unauthorized - account does not belong to you' })
  }

  const amount = Number(body && body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(res, 400, { message: 'Invalid deposit amount' })
  }

  account.balance = Math.round((account.balance + amount) * 100) / 100
  const result = { status: 201, body: accountResponse(account) }
  if (idempotencyKey) idempotency.set(idempotencyKey, result)
  json(res, result.status, result.body)
}

async function handlePayment(res, authHeader, idempotencyKey, body) {
  const user = userFromAuthHeader(res, authHeader)
  if (!user) return unauthorized(res)

  const replay = idempotencyKey ? idempotency.get(idempotencyKey) : undefined
  if (replay) return json(res, 200, replay.body)

  const { sender, receiver, amount } = body || {}
  const senderAccount = accountsByNumber.get(String(sender))
  if (!senderAccount) return json(res, 404, { message: 'Sender account not found' })
  if (senderAccount.userId !== user.userId) {
    return json(res, 403, { message: 'Unauthorized - account does not belong to you' })
  }
  if (String(sender).trim() === String(receiver).trim()) {
    return json(res, 400, { message: "Sender and Reciever can't be same" })
  }
  const receiverAccount = accountsByNumber.get(String(receiver))
  if (!receiverAccount) return json(res, 404, { message: 'Receiver account not found' })

  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) {
    return json(res, 400, { message: 'Invalid amount' })
  }
  if (value > senderAccount.balance) {
    return json(res, 400, { message: 'Insufficient Balance' })
  }

  senderAccount.balance = Math.round((senderAccount.balance - value) * 100) / 100
  receiverAccount.balance = Math.round((receiverAccount.balance + value) * 100) / 100
  const tx = {
    id: crypto.randomUUID(),
    sender: senderAccount.number,
    receiver: receiverAccount.number,
    amount: value,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    message: 'Payment processed',
  }
  transactions.push(tx)
  const result = { status: 201, body: tx }
  if (idempotencyKey) idempotency.set(idempotencyKey, result)
  json(res, result.status, result.body)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  if (req.method === 'OPTIONS') return json(res, 204, {})

  let body = null
  if (req.method === 'POST') {
    try {
      body = await new Promise((resolve, reject) => {
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', () => {
          if (!raw) return resolve(null)
          try {
            resolve(JSON.parse(raw))
          } catch {
            reject(new Error('bad json'))
          }
        })
        req.on('error', reject)
      })
    } catch {
      return json(res, 400, { message: 'Malformed JSON body' })
    }
  }

  try {
    if (req.method === 'POST' && path === '/api/v1/auth/register') {
      return await handleRegister(res, body)
    }
    if (req.method === 'POST' && path === '/api/v1/auth/login') {
      return await handleLogin(res, body)
    }
    if (req.method === 'GET' && path === '/api/v1/accounts/me') {
      return await handleGetMe(res, req.headers.authorization)
    }
    const depositMatch = path.match(/^\/api\/v1\/accounts\/([^/]+)\/deposit$/)
    if (req.method === 'POST' && depositMatch) {
      return await handleDeposit(
        res,
        req.headers.authorization,
        req.headers['idempotency-key'],
        depositMatch[1],
        body,
      )
    }
    if (req.method === 'POST' && path === '/api/v1/payments') {
      return await handlePayment(res, req.headers.authorization, req.headers['idempotency-key'], body)
    }
    json(res, 404, { message: 'Not found' })
  } catch (err) {
    console.error(err)
    json(res, 500, { message: 'Internal server error' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock payment gateway (dev stand-in) listening on http://127.0.0.1:${PORT}/api/v1`)
  console.log('In-memory state: restart to reset. The real Spring gateway is a drop-in replacement on the same port.')
})
