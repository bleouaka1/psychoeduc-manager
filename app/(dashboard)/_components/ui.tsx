import type { LucideIcon } from 'lucide-react'

export function PageHeader({
  eyebrowIcon: EyebrowIcon,
  eyebrowText,
  title,
  subtitle,
  actions,
}: {
  eyebrowIcon?: LucideIcon
  eyebrowText?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="flex items-start justify-between mb-9 gap-4 pb-7 border-b border-border-soft/70">
      <div>
        {eyebrowText && (
          <p className="flex items-center gap-2 text-accent-gold font-semibold text-[12.5px] tracking-wide mb-2.5">
            {EyebrowIcon && (
              <span className="w-6 h-6 rounded-md bg-accent-gold/12 flex items-center justify-center shrink-0">
                <EyebrowIcon size={13} strokeWidth={2.25} />
              </span>
            )}
            {eyebrowText.toUpperCase()}
          </p>
        )}
        <h1 className="font-display font-semibold text-4xl text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-text-muted mt-2 text-[14.5px] max-w-xl">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}

export function Panel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title?: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`card-elevated bg-bg-card border border-border-soft rounded-2xl p-6 ${className}`}>
      {title && (
        <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4 flex items-center gap-2.5">
          {Icon && (
            <span className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-accent-gold/20 to-accent-gold/5 flex items-center justify-center shrink-0">
              <Icon size={14} className="text-accent-gold" />
            </span>
          )}
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="group card-elevated bg-bg-card border border-border-soft rounded-2xl p-[22px] transition-all duration-200 hover:-translate-y-[3px] hover:border-accent-gold-dim/50">
      <div className="w-[34px] h-[34px] rounded-[9px] bg-gradient-to-br from-accent-gold/25 to-accent-gold/5 ring-1 ring-accent-gold/10 flex items-center justify-center mb-3.5 transition-transform duration-200 group-hover:scale-105">
        <Icon size={17} className="text-accent-gold" />
      </div>
      <p className="font-data text-[30px] font-semibold text-text-primary leading-tight mb-1">{value}</p>
      <p className="text-[13.5px] text-text-primary font-medium">{label}</p>
      {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
    </div>
  )
}

const STATUS_STYLES: Record<'ok' | 'warn' | 'down' | 'idle', string> = {
  ok: 'bg-status-ok-bg text-status-ok shadow-[0_0_0_1px_rgba(79,209,165,0.12)]',
  warn: 'bg-status-warn-bg text-status-warn shadow-[0_0_0_1px_rgba(232,185,92,0.12)]',
  down: 'bg-danger/20 text-danger shadow-[0_0_0_1px_rgba(226,114,91,0.12)]',
  idle: 'bg-bg-surface text-text-muted border border-border-soft',
}

export function StatusPill({ status, children }: { status: 'ok' | 'warn' | 'down' | 'idle'; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${status === 'ok' ? 'animate-pulse' : ''}`} />
      {children}
    </span>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <p className="text-text-muted text-sm py-6 text-center">{text}</p>
}

export function DataTable({
  columns,
  rows,
  emptyText = 'Aucune donnée pour le moment.',
}: {
  columns: string[]
  rows: (string | number | React.ReactNode)[][]
  emptyText?: string
}) {
  if (rows.length === 0) return <EmptyState text={emptyText} />
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-muted border-b border-border-soft">
            {columns.map((c) => (
              <th key={c} className="px-2 py-2.5 font-medium text-xs uppercase tracking-wide">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border-soft/60 last:border-0 transition-colors hover:bg-white/[0.02]">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-3 text-text-primary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Cadran signature "Boussole d'IGA" — remplace tout affichage brut du score IGA. */
export function IgaDial({ value, label = 'Score IGA moyen' }: { value: number | null; hint?: string; label?: string }) {
  const radius = 62
  const circumference = 2 * Math.PI * radius
  const clamped = value == null ? 0 : Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="card-elevated bg-bg-card border border-border-soft rounded-2xl p-[22px] flex flex-col items-center justify-center">
      <div className="relative w-[150px] h-[150px]">
        <svg viewBox="0 0 150 150" className="w-[150px] h-[150px] -rotate-90">
          <defs>
            <linearGradient id="iga-dial-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-gold)" />
              <stop offset="100%" stopColor="var(--accent-teal)" />
            </linearGradient>
            <filter id="iga-dial-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="75" cy="75" r={radius} fill="none" stroke="var(--border-soft)" strokeWidth="8" />
          {value != null && (
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke="url(#iga-dial-gradient)"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              filter="url(#iga-dial-glow)"
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-data text-[28px] font-semibold text-text-primary">{value == null ? '—' : Math.round(value)}</span>
          <span className="text-[10.5px] text-text-muted tracking-wide">SUR 100</span>
        </div>
      </div>
      <p className="mt-3.5 text-[13px] text-text-muted text-center">{label}</p>
    </div>
  )
}
