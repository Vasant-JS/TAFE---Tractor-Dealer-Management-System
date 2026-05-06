import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import StatusPill from '../components/ui/StatusPill'
import { useAuthStore } from '../store/auth.store'

export default function Profile() {
  const { user } = useAuthStore()
  const [audit, setAudit] = useState<any[]>([])

  useEffect(() => {
    api.get('/audit').then(({ data }) => setAudit(data)).catch(() => toast.error('Could not load profile activity'))
  }, [])

  return (
    <div>
      <PageHeader icon="person" title="User Profile" subtitle="Signed-in user details and latest database activity." />
      <div className="grid gap-6 p-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded border border-outline-variant bg-white p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded bg-green-900 font-display text-xl font-bold text-white">
              {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-green-950">{user?.name || 'User'}</h2>
              <p className="text-sm text-on-surface-variant">{user?.email}</p>
              <div className="mt-2"><StatusPill tone="info">{user?.role || 'role'}</StatusPill></div>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-b border-outline-variant py-2"><span>Dealer Code</span><span className="font-mono">{user?.dealerCode || ''}</span></div>
            <div className="flex justify-between border-b border-outline-variant py-2"><span>User ID</span><span className="font-mono text-xs">{user?.id || ''}</span></div>
          </div>
        </section>
        <section className="rounded border border-outline-variant bg-white">
          <h2 className="border-b border-outline-variant px-5 py-4 font-display text-xl font-semibold text-green-950">Recent Activity</h2>
          <div className="space-y-2 p-5">
            {audit.map((row) => (
              <div key={row.id} className="rounded border border-outline-variant p-3 text-sm">
                <p className="font-semibold">{row.action}</p>
                <p className="text-xs text-on-surface-variant">{row.module} | {new Date(row.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!audit.length ? <p className="text-sm text-on-surface-variant">No activity yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
