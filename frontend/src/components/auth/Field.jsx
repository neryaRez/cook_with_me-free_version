export const inputClass =
  'w-full rounded-xl border border-border-subtle/70 bg-surface px-4 py-2.5 text-sm text-cream placeholder:text-muted/70 outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/20'

export default function Field({ label, hint, helperText, error, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-cream">{label}</span>
        {hint}
      </div>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span>
      ) : helperText ? (
        <span className="mt-1.5 block text-xs text-muted">{helperText}</span>
      ) : null}
    </label>
  )
}
