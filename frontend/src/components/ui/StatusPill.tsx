import type { StatusTone } from '../../data/dmsData'

const toneMap: Record<StatusTone, string> = {
  success: 'bg-green-800 text-white',
  warning: 'bg-amber-500 text-amber-950',
  danger: 'bg-red-700 text-white',
  info: 'bg-slate-800 text-white',
  neutral: 'bg-slate-200 text-slate-800',
}

export default function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: StatusTone }) {
  return <span className={`inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${toneMap[tone]}`}>{children}</span>
}
