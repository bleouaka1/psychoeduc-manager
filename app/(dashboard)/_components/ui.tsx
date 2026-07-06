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
    <header className="flex items-start justify-between mb-9 gap-4">
      <div>
        {eyebrowText && (
          <p className="flex items-center gap-2 text-accent-gold font-semibold text-[12.5px] tracking-wide mb-2.5">
            {EyebrowIcon && <EyebrowIcon size={15} strokeWidth={2.25} />}
            {eyebrowText.toUpperCase()}
          </p>
        )}
        <h1 className="font-display font-semibold text-4xl text-text-primary">{title}</h1>
        {subtitle && <p className="text-text-muted mt-1.5 text-[14.5px]">{subtitle}</p>}
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
    <section
      className={`bg-bg-card border border-border-soft rounded-2xl p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}
    >
      {title && (
        <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4 flex items-center gap-2">
          {Icon && <Icon size={16} className="text-accent-gold" />}
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
    <div className="bg-bg-card border border-border-soft rounded-2xl p-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="w-[34px] h-[34px] rounded-[9px] bg-accent-gold/10 flex items-center justify-center mb-3.5">
        <Icon size={17} className="text-accent-gold" />
      </div>
      <p className="font-data text-[30px] font-semibold text-text-primary leading-tight mb-1">{value}</p>
      <p className="text-[13.5px] text-text-primary font-medium">{label}</p>
      {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
    </div>
  )
}

const STATUS_STYLES: Record<'ok' | 'warn' | 'down' | 'idle', string> = {
  ok: 'bg-accent-teal-dim text-[#bff2ec]',
  warn: 'bg-accent-gold-dim/50 text-accent-gold',
  down: 'bg-danger/20 text-danger',
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
              <th key={c} className="px-2 py-2 font-medium text-xs uppercase tracking-wide">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border-soft/60 last:border-0">
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
    <div className="bg-bg-card border border-border-soft rounded-2xl p-[22px] flex flex-col items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="relative w-[150px] h-[150px]">
        <svg viewBox="0 0 150 150" className="w-[150px] h-[150px] -rotate-90">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="var(--border-soft)" strokeWidth="8" />
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="var(--accent-gold)"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
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
