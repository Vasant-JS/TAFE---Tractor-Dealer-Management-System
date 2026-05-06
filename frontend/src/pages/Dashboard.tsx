import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type DashboardPayload = {
  kpis?: Array<{ label: string; value: number | string; helper?: string; tone?: string }>
  pipeline?: {
    pending?: number
    ready?: number
    allocated?: number
    delivered?: number
  }
  vehicles?: Array<{
    id: string
    code: string
    model: string
    status: string
    engineNo: string
    chassisNo: string
    createdAt?: string
    customer?: { name?: string | null } | null
  }>
  queue?: Array<{
    id: string
    ref: string
    moduleKey: string
    status: string
    due?: string | null
    amount?: number | null
    updatedAt?: string
    vehicle?: { code?: string | null; model?: string | null } | null
    customer?: { name?: string | null } | null
    owner?: { name?: string | null } | null
  }>
  alerts?: Array<{ id: string; module: string; message: string }>
}

const pipelineLabels = [
  { key: 'pending', label: 'Pending PDI', statuses: ['Pending PDI'] },
  { key: 'ready', label: 'Ready for Install', statuses: ['Ready for Installation'] },
  { key: 'allocated', label: 'Allocated', statuses: ['Allocated to Customer'] },
  { key: 'delivered', label: 'Delivered', statuses: ['Delivered', 'RTO Filed'] },
]

const activityToneStyles: Record<string, string> = {
  success: 'bg-green-900',
  danger: 'bg-red-700',
  neutral: 'bg-slate-300',
}

function formatCurrency(value: number) {
  return `Rs. ${value.toLocaleString('en-IN')}`
}

function formatRelativeTime(value?: string) {
  if (!value) return 'Recently updated'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return value
  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000))
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

function parseDueDate(value?: string | null) {
  if (!value) return null
  const exact = new Date(value)
  if (!Number.isNaN(exact.getTime())) return exact
  const fallback = new Date(`${value}T00:00:00`)
  if (!Number.isNaN(fallback.getTime())) return fallback
  return null
}

function daysLeftLabel(value?: string | null) {
  const due = parseDueDate(value)
  if (!due) return { label: '--', tone: 'neutral' as const }
  const diff = Math.ceil((due.getTime() - Date.now()) / 86400000)
  if (diff <= 7) return { label: `${Math.max(diff, 0).toString().padStart(2, '0')} DAYS`, tone: 'danger' as const }
  if (diff <= 15) return { label: `${diff.toString().padStart(2, '0')} DAYS`, tone: 'warning' as const }
  return { label: `${diff.toString().padStart(2, '0')} DAYS`, tone: 'info' as const }
}

function downloadBlob(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportDashboardSnapshot(payload: DashboardPayload | null) {
  if (!payload) {
    toast.error('Dashboard data is still loading')
    return
  }
  downloadBlob(`dashboard-snapshot-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json')
  toast.success('Dashboard snapshot exported')
}

function exportDashboardReport(payload: DashboardPayload | null) {
  if (!payload) {
    toast.error('Dashboard data is still loading')
    return
  }

  const lines = [
    'TAFE DMS Dashboard Report',
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    '',
    'KPIs',
    ...(payload.kpis ?? []).map((item) => `- ${item.label}: ${item.value}`),
    '',
    'Recent Activity',
    ...(payload.queue ?? []).slice(0, 5).map((item) => `- ${item.ref} | ${item.moduleKey} | ${item.status}`),
  ]

  downloadBlob(`dashboard-report-${new Date().toISOString().slice(0, 10)}.txt`, lines.join('\n'), 'text/plain;charset=utf-8')
  toast.success('Dashboard report generated')
}

function StatCard({
  label,
  value,
  helper,
  accent = 'green',
  badge,
  icon,
}: {
  label: string
  value: string
  helper?: string
  accent?: 'green' | 'red'
  badge?: string
  icon?: string
}) {
  return (
    <div className={`border bg-white px-5 py-5 shadow-sm ${accent === 'red' ? 'border-red-100 border-l-4 border-l-red-600 bg-red-50/60' : 'border-outline-variant border-l-4 border-l-green-800'}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${accent === 'red' ? 'text-red-700' : 'text-slate-500'}`}>{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className={`font-display text-[1.2rem] font-semibold leading-none ${accent === 'red' ? 'text-red-700' : 'text-green-950'}`}>{value}</p>
          {helper ? <p className="mt-2 text-xs text-slate-400">{helper}</p> : null}
        </div>
        {badge ? (
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${accent === 'red' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
            {badge}
          </span>
        ) : null}
        {icon ? <span className={`material-symbols-outlined text-3xl ${accent === 'red' ? 'text-red-500' : 'text-green-600'}`}>{icon}</span> : null}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/dashboard')
      .then(({ data }) => setDashboard(data))
      .catch(() => toast.error('Dashboard API unavailable'))
  }, [])

  const liveVehicles = dashboard?.vehicles ?? []
  const liveQueue = dashboard?.queue ?? []
  const liveAlerts = dashboard?.alerts ?? []

  const vehicleTotal = Number(dashboard?.kpis?.[0]?.value ?? liveVehicles.length ?? 0)
  const pendingReceivables = Number(dashboard?.kpis?.[3]?.value ?? 0)
  const deliveredThisMonth = liveVehicles.filter((vehicle) => vehicle.status === 'Delivered').length
  const openServiceRequests = liveQueue.filter((item) => item.moduleKey === 'service' && !['Closed', 'Complete'].includes(item.status)).length
  const atsRedAlerts = liveAlerts.filter((alert) => alert.module.toLowerCase().includes('ats')).length
  const pendingPaymentsCount = liveQueue.filter((item) => item.moduleKey === 'accounts' && !['Financially Closed', 'Complete', 'Closed'].includes(item.status)).length

  const pipelineStages = useMemo(() => {
    const pipelineMap = dashboard?.pipeline
    const counts = pipelineLabels.map((stage) => {
      const count =
        stage.key === 'pending'
          ? Number(pipelineMap?.pending ?? 0)
          : stage.key === 'ready'
            ? Number(pipelineMap?.ready ?? 0)
            : stage.key === 'allocated'
              ? Number(pipelineMap?.allocated ?? 0)
              : Number(pipelineMap?.delivered ?? 0)
      return {
        ...stage,
        count,
      }
    })
    const hasBackendCounts = counts.some((stage) => stage.count > 0)
    const resolvedCounts = hasBackendCounts
      ? counts
      : pipelineLabels.map((stage) => {
          const count = liveVehicles.filter((vehicle) => stage.statuses.includes(vehicle.status)).length
          return {
            ...stage,
            count,
          }
        })
    const highestCount = Math.max(1, ...resolvedCounts.map((stage) => stage.count))
    return resolvedCounts.map((stage) => ({
      ...stage,
      progress: stage.count === 0 ? 0 : Math.max(14, Math.round((stage.count / highestCount) * 100)),
    }))
  }, [dashboard?.pipeline, liveVehicles])

  const recentActivity = useMemo(() => {
    if (liveQueue.length) {
      return liveQueue.slice(0, 3).map((item) => {
        const title =
          item.moduleKey === 'purchase'
            ? `New Purchase Invoice ${item.ref}`
            : item.moduleKey === 'ats'
              ? `ATS Alert: ${item.status}`
              : item.moduleKey === 'delivery'
                ? 'Delivery Sheet Uploaded'
                : `${item.ref} updated`
        const tone =
          item.moduleKey === 'ats' || item.status.toLowerCase().includes('fail') || item.status.toLowerCase().includes('alert')
            ? 'danger'
            : item.moduleKey === 'purchase'
              ? 'success'
              : 'neutral'
        return {
          id: item.id,
          title,
          subtitle: `${formatRelativeTime(item.updatedAt)}${item.owner?.name ? ` • ${item.owner.name}` : item.customer?.name ? ` • ${item.customer.name}` : ''}`,
          tone,
          icon: item.moduleKey === 'ats' ? 'priority_high' : item.moduleKey === 'delivery' ? 'description' : 'open_in_new',
        }
      })
    }

    return liveAlerts.slice(0, 3).map((alert, index) => ({
      id: alert.id,
      title: alert.message,
      subtitle: `${alert.module} alert`,
      tone: index === 0 ? 'danger' : 'neutral',
      icon: index === 0 ? 'priority_high' : 'open_in_new',
    }))
  }, [liveAlerts, liveQueue])

  const insuranceAlerts = useMemo(() => {
    const insuranceItems = liveQueue
      .filter((item) => item.moduleKey === 'insurance')
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        customer: item.customer?.name ?? 'Unassigned customer',
        vehicleId: item.vehicle?.code ?? item.ref,
        expiryDate: item.due ?? '--',
        days: daysLeftLabel(item.due),
      }))

    return insuranceItems
  }, [liveQueue])

  const criticalAtsItems = useMemo(() => {
    return liveQueue
      .filter((item) => item.moduleKey === 'ats' && !['Closed', 'Complete'].includes(item.status))
      .slice(0, 2)
      .map((item) => ({
        id: item.id,
        vehicleRef: item.vehicle?.code ?? item.ref,
        issue: item.status,
      }))
  }, [liveQueue])

  const atsHealthPercent = vehicleTotal > 0 ? Math.max(0, Math.min(100, Math.round(((vehicleTotal - atsRedAlerts) / vehicleTotal) * 100))) : 100
  const healthRingStyle = {
    background: `conic-gradient(#0f6b1b 0 ${Math.max(12, atsHealthPercent)}%, #ff8f00 ${Math.max(12, atsHealthPercent)}% ${Math.max(18, atsHealthPercent + 8)}%, #d11f1f ${Math.max(18, atsHealthPercent + 8)}% ${Math.max(24, atsHealthPercent + 14)}%, #e6eadf ${Math.max(24, atsHealthPercent + 14)}% 100%)`,
  }

  return (
    <div className="min-h-full bg-[#f5f8ec]">
      <div className="space-y-6 p-6">
        <div className="grid gap-4 xl:grid-cols-5">
          <StatCard label="Total Vehicles in Stock" value={String(vehicleTotal)} helper={vehicleTotal ? '+Live DB stock' : 'No vehicles yet'} />
          <StatCard label="Delivered This Month" value={String(deliveredThisMonth)} helper="Vehicles marked delivered" icon="trending_up" />
          <StatCard label="Open Service Requests" value={String(openServiceRequests)} helper="Pending workshop and field jobs" badge="Active" />
          <StatCard label="ATS Red Alerts" value={String(atsRedAlerts).padStart(2, '0')} helper="Critical follow-up items" accent="red" icon="warning" />
          <StatCard label="Pending Payments" value={formatCurrency(pendingReceivables)} helper={`Across ${pendingPaymentsCount.toString().padStart(2, '0')} open items`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <section className="border border-outline-variant border-l-4 border-l-green-800 bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 py-6">
              <h2 className="font-display text-[1.15rem] font-medium text-green-950">Vehicle Pipeline Funnel</h2>
              <button
                type="button"
                onClick={() => navigate('/purchase-invoices')}
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em] text-green-950"
              >
                View All
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>
            <div className="grid gap-5 px-6 pb-6 md:grid-cols-4">
              {pipelineStages.map((stage) => (
                <div key={stage.key} className="border border-outline-variant bg-slate-50/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{stage.label}</p>
                  <p className="mt-3 font-mono text-[1.55rem] text-green-950">{String(stage.count).padStart(2, '0')}</p>
                  <div className="mt-5 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-green-900" style={{ width: `${stage.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-outline-variant border-l-4 border-l-green-800 bg-white shadow-sm">
            <div className="px-6 py-6">
              <h2 className="font-display text-[1.15rem] font-medium text-green-950">Recent Activity</h2>
            </div>
            <div className="space-y-1 px-6 pb-6">
              {recentActivity.length ? recentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-4 border-b border-slate-100 py-5 last:border-b-0">
                  <span className={`mt-2 h-2.5 w-2.5 rounded-full ${activityToneStyles[item.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[1rem] leading-snug text-green-950">{item.title}</p>
                    <p className="mt-3 text-sm text-slate-500">{item.subtitle}</p>
                  </div>
                  <span className={`material-symbols-outlined mt-1 text-lg ${item.tone === 'danger' ? 'text-red-600' : 'text-slate-300'}`}>{item.icon}</span>
                </div>
              )) : (
                <div className="px-1 py-10 text-sm text-slate-500">No recent activity yet. Create your first workflow record to populate the dashboard feed.</div>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <section className="border border-outline-variant border-l-4 border-l-green-800 bg-white shadow-sm">
            <div className="px-6 py-6">
              <h2 className="font-display text-[1.15rem] font-medium text-green-950">Insurance Expiry Alerts</h2>
            </div>
            <div className="overflow-hidden border-t border-outline-variant">
              <div className="grid grid-cols-[1.2fr_1fr_0.9fr_0.9fr_0.8fr] bg-green-800 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">
                <span>Customer</span>
                <span>Vehicle ID</span>
                <span>Expiry Date</span>
                <span>Days Left</span>
                <span>Action</span>
              </div>
              {insuranceAlerts.length ? insuranceAlerts.map((row, index) => (
                <div key={row.id} className={`grid grid-cols-[1.2fr_1fr_0.9fr_0.9fr_0.8fr] items-center gap-4 px-6 py-5 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                  <span className="text-[0.98rem] text-green-950">{row.customer}</span>
                  <span className="font-mono text-[0.98rem] text-green-950">{row.vehicleId}</span>
                  <span className="text-[0.98rem] text-green-950">{row.expiryDate}</span>
                  <span>
                    <span className={`inline-flex min-w-[64px] justify-center px-2 py-2 text-[11px] font-bold uppercase ${
                      row.days.tone === 'danger'
                        ? 'bg-red-600 text-white'
                        : row.days.tone === 'warning'
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-500 text-white'
                    }`}>
                      {row.days.label}
                    </span>
                  </span>
                  <button type="button" onClick={() => navigate('/insurance')} className="bg-green-900 px-4 py-2 text-sm font-semibold text-white">
                    Renew
                  </button>
                </div>
              )) : (
                <div className="px-6 py-10 text-sm text-slate-500">No insurance follow-ups are in the live database yet. Insurance workflow items will appear here automatically.</div>
              )}
            </div>
          </section>

          <section className="border border-outline-variant border-l-4 border-l-green-800 bg-white shadow-sm">
            <div className="px-6 py-6">
              <h2 className="font-display text-[1.15rem] font-medium text-green-950">ATS Health Status</h2>
            </div>
            <div className="px-6 pb-6">
              <div className="mx-auto mt-2 flex h-44 w-44 items-center justify-center rounded-full" style={healthRingStyle}>
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white text-center">
                  <p className="font-display text-[1.6rem] font-semibold text-green-950">{atsHealthPercent}%</p>
                  <p className="mt-1 text-[12px] uppercase tracking-[0.08em] text-slate-400">Fleet Optimal</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-red-700">
                  <span className="material-symbols-outlined text-base">warning</span>
                  Critical Red Alerts ({String(atsRedAlerts).padStart(2, '0')})
                </p>
                <div className="mt-4 space-y-3">
                  {criticalAtsItems.length ? criticalAtsItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-800">
                      <span className="font-mono">{item.vehicleRef}</span>
                      <span>{item.issue}</span>
                    </div>
                  )) : (
                    <div className="border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">No ATS critical alerts are open in the live database.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-outline-variant bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm italic text-slate-500">Auto-refreshing from live database on each page load.</p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => exportDashboardSnapshot(dashboard)}
              className="border border-green-900 bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.05em] text-green-950"
            >
              Export Dashboard
            </button>
            <button
              type="button"
              onClick={() => exportDashboardReport(dashboard)}
              className="bg-green-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.05em] text-white"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
