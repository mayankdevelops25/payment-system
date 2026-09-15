// Small frontend-only helpers (formatting, greetings, error detection).

export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AED: 'AED ',
  NGN: '₦',
  SGD: 'S$',
}

export function currencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `
}

export function formatMoney(amount, currency) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return currencySymbol(currency) + '0.00'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value)
  } catch {
    return `${currencySymbol(currency)}${value.toFixed(2)}`
  }
}

export function timeGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// A rejected fetch() promise (DNS failure, refused connection, CORS preflight
// gone bad) rejects with a TypeError. HTTP-level errors are wrapped into
// Error by api.js, so this is a reliable "backend is unreachable" signal.
export function isNetworkError(err) {
  return err instanceof TypeError
}

// "1002345678901234" -> "••••  ••••  ••••  1234"
export function maskAccountNumber(number) {
  const n = String(number ?? '')
  if (n.length <= 4) return n
  if (n.length <= 8) return `••••  ${n.slice(-4)}`
  return `••••  ••••  ••••  ${n.slice(-4)}`
}
