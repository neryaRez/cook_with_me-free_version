const UNITS = [
  { limit: 60, divisor: 1, label: 'just now', instant: true },
  { limit: 3600, divisor: 60, label: 'm ago' },
  { limit: 86400, divisor: 3600, label: 'h ago' },
  { limit: 604800, divisor: 86400, label: 'd ago' },
]

export function formatRelativeTime(isoString) {
  if (!isoString) return ''

  const then = new Date(isoString).getTime()
  if (Number.isNaN(then)) return ''

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))

  for (const unit of UNITS) {
    if (seconds < unit.limit) {
      return unit.instant ? unit.label : `${Math.max(1, Math.floor(seconds / unit.divisor))}${unit.label}`
    }
  }

  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
