import { CheckIcon, AlertIcon, InfoIcon, XIcon } from './Icons'

const ICONS = {
  success: CheckIcon,
  error: AlertIcon,
  info: InfoIcon,
}

export default function Toasts({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || InfoIcon
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">
              <Icon size={17} />
            </span>
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(t.id)}
            >
              <XIcon size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
