import { Link } from 'react-router-dom'
import { ChefHatIcon } from '../../components/icons.jsx'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative overflow-hidden bg-noise">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-ember/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-md flex-col px-4 py-16 sm:py-20">
        <Link to="/" className="mx-auto mb-8 flex items-center gap-2.5 text-cream">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember/15 text-ember-light">
            <ChefHatIcon className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Cook <span className="text-gradient">With Me</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-border-subtle/70 bg-card p-8 shadow-xl shadow-ember/5">
          <h1 className="font-display text-2xl font-bold text-cream">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
      </div>
    </div>
  )
}
