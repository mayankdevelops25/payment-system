import { BoltIcon, ChipIcon, ContactlessIcon } from './Icons'
import { maskAccountNumber } from '../utils'

export default function BankCard({ account }) {
  const holder = String(account.owner || 'CARD HOLDER').toUpperCase().slice(0, 22)

  return (
    <div className="bank-card" role="img" aria-label={`Payment card for ${account.owner}`}>
      <div className="bank-card-glow bank-card-glow-a" aria-hidden="true" />
      <div className="bank-card-glow bank-card-glow-b" aria-hidden="true" />

      <div className="bank-card-top">
        <span className="bank-card-brand">
          <BoltIcon size={15} />
          Payment System
        </span>
        <span className="bank-card-contactless">
          <ContactlessIcon size={22} />
        </span>
      </div>

      <div className="bank-card-mid">
        <ChipIcon size={38} className="bank-card-chip" />
      </div>

      <div className="bank-card-number" aria-hidden="true">
        {maskAccountNumber(account.number)}
      </div>

      <div className="bank-card-bottom">
        <div className="bank-card-field">
          <span className="bank-card-label">Card holder</span>
          <span className="bank-card-value">{holder}</span>
        </div>
        <div className="bank-card-field">
          <span className="bank-card-label">Currency</span>
          <span className="bank-card-value">{account.currency}</span>
        </div>
        <div className="bank-card-field">
          <span className="bank-card-label">Type</span>
          <span className="bank-card-value">VIRTUAL</span>
        </div>
      </div>
    </div>
  )
}
