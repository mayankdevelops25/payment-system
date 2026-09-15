import { useEffect, useRef, useState } from 'react'

// Animates `display` toward `target` with an ease-out curve whenever target
// changes. Used for the balance "tick" when it goes up or down.
export function useCountUp(target, duration = 650) {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    const from = displayRef.current
    const to = Number(target)
    if (!Number.isFinite(to) || from === to) {
      displayRef.current = to
      setDisplay(to)
      return
    }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const value = from + (to - from) * eased
      displayRef.current = value
      setDisplay(value)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return display
}
