// Minimal inline icon set (24x24 stroke icons) so the UI has zero icon
// dependencies.

function Svg({ size = 18, children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const BoltIcon = (p) => (
  <Svg {...p}>
    <path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" />
  </Svg>
)

export const MailIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7.5 8.5 5.8 8.5-5.8" />
  </Svg>
)

export const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
)

export const UserIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20c.9-3.4 3.8-5.2 7.2-5.2s6.3 1.8 7.2 5.2" />
  </Svg>
)

export const EyeIcon = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
)

export const EyeOffIcon = (p) => (
  <Svg {...p}>
    <path d="M10.7 6.1A9.5 9.5 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.7 3.4M6.4 7.6A16.7 16.7 0 0 0 2.5 12S6 18 12 18a9.3 9.3 0 0 0 4.3-1.1" />
    <path d="M9.9 10.2a2.8 2.8 0 0 0 3.9 3.9" />
    <path d="m4 4 16 16" />
  </Svg>
)

export const ShieldIcon = (p) => (
  <Svg {...p}>
    <path d="M12 2.8 4.5 5.6v5.6c0 4.6 3.1 8.4 7.5 10 4.4-1.6 7.5-5.4 7.5-10V5.6L12 2.8Z" />
    <path d="m9 11.8 2.2 2.2L15.3 9.7" />
  </Svg>
)

export const SendIcon = (p) => (
  <Svg {...p}>
    <path d="M21 3 10.4 13.6" />
    <path d="M21 3 14 21l-3.6-7.4L3 10 21 3Z" />
  </Svg>
)

export const PlusIcon = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const WalletIcon = (p) => (
  <Svg {...p}>
    <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
    <path d="M3 5v13a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" />
    <circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
)

export const CopyIcon = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5" />
  </Svg>
)

export const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
)

export const LogOutIcon = (p) => (
  <Svg {...p}>
    <path d="M9 21H5.5A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3H9" />
    <path d="m15 16.5 4.5-4.5L15 7.5" />
    <path d="M19.5 12H9" />
  </Svg>
)

export const AlertIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V13" />
    <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
  </Svg>
)

export const InfoIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none" />
  </Svg>
)

export const XIcon = (p) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
)

export const RefreshIcon = (p) => (
  <Svg {...p}>
    <path d="M20 5v5h-5" />
    <path d="M20 10a8 8 0 1 0 1.7 6" />
  </Svg>
)

export const ContactlessIcon = (p) => (
  <Svg {...p}>
    <path d="M6.5 9.2a5.5 5.5 0 0 1 0 5.6" />
    <path d="M10 7a9.5 9.5 0 0 1 0 10" />
    <path d="M13.5 4.8a13.5 13.5 0 0 1 0 14.4" />
  </Svg>
)

export const ChipIcon = (p) => (
  <Svg {...p} strokeWidth="1.8">
    <rect x="4" y="6" width="16" height="12" rx="2.5" />
    <path d="M4 10.5h3.5M4 13.5h3.5M16.5 10.5H20M16.5 13.5H20M12 6v12M8.5 12h7" />
  </Svg>
)

export const ArrowRightIcon = (p) => (
  <Svg {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Svg>
)

export const TrendUpIcon = (p) => (
  <Svg {...p}>
    <path d="m3 16.5 6-6 4 4L21 7" />
    <path d="M15.5 7H21v5.5" />
  </Svg>
)
