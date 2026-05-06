import StatusPill from './StatusPill'
import type { KPI } from '../../data/dmsData'

export default function KpiCard({ item }: { item: KPI }) {
  return (
    <div className="card-accent-border rounded border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{item.label}</p>
        <StatusPill tone={item.tone}>{item.tone}</StatusPill>
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-on-surface">{item.value}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{item.helper}</p>
    </div>
  )
}
