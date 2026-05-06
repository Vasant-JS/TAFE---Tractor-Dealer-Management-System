import type { WorkItem } from '../../data/dmsData'
import StatusPill from './StatusPill'

export default function DataTable({ rows, onComplete }: { rows: WorkItem[]; onComplete?: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded border border-outline-variant bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-green-900 text-white">
          <tr className="text-left font-display text-xs uppercase tracking-wider">
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Vehicle</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3">Due</th>
            {onComplete ? <th className="px-4 py-3 text-right">Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={index % 2 ? 'bg-surface-container-low' : 'bg-white'}>
              <td className="px-4 py-3 font-mono text-xs text-green-950">{(row as any).ref || row.id}</td>
              <td className="px-4 py-3 font-semibold text-on-surface">{row.customer}</td>
              <td className="px-4 py-3 text-on-surface-variant">{row.vehicle}</td>
              <td className="px-4 py-3 text-on-surface-variant">{row.owner}</td>
              <td className="px-4 py-3"><StatusPill tone={row.status === 'Complete' ? 'success' : row.status === 'OTP Pending' ? 'warning' : 'info'}>{row.status}</StatusPill></td>
              <td className="px-4 py-3 text-right font-mono">{row.amount ?? '-'}</td>
              <td className="px-4 py-3 text-on-surface-variant">{row.due}</td>
              {onComplete ? (
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onComplete(row.id)} className="rounded border border-green-900 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-green-950">Complete</button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <div className="p-5 text-sm text-on-surface-variant">No database records yet.</div> : null}
    </div>
  )
}
