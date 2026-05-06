import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type Row = {
  id: string
  status: string
  amount?: number | null
  due: string
  payload?: string | null
  vehicle?: { code: string; model: string } | null
  customer?: { name: string } | null
}

function parsePayload(payload?: string | null) {
  try { return payload ? JSON.parse(payload) : {} } catch { return {} }
}

const initial = {
  'Taxable Amount': '',
  Discount: '',
  Charges: '',
  'Net Settlement': '',
  Approver: '',
}

export default function ATSChargeSheet() {
  const navigate = useNavigate()
  const [accountRows, setAccountRows] = useState<Row[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [values, setValues] = useState(initial)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const [atsRes, accountRes] = await Promise.all([api.get('/modules/ats/work-items'), api.get('/modules/accounts/work-items')])
    setRows(atsRes.data)
    const eligible = accountRes.data.filter((row: Row) => row.status === 'Complete')
    setAccountRows(eligible)
    if (eligible[0]) setSelectedAccountId((current) => current || eligible[0].id)
  }

  useEffect(() => { load().catch(() => toast.error('Could not load ATS records')) }, [])

  const selectedAccount = useMemo(() => accountRows.find((row) => row.id === selectedAccountId) ?? null, [accountRows, selectedAccountId])
  const healthyCount = rows.filter((row) => row.status === 'Complete').length

  const submit = async () => {
    if (!selectedAccount) return toast.error('Select a closed accounts deal first')
    const payload = parsePayload(selectedAccount.payload)
    setLoading(true)
    try {
      await api.post('/modules/ats/work-items', {
        'Vehicle Code': selectedAccount.vehicle?.code ?? '',
        'Deal ID': selectedAccount.id,
        'Customer Ledger': `${selectedAccount.vehicle?.code ?? 'LEDGER'}-LEDGER`,
        ...values,
        'Due Date': dueDate,
        'Notes': notes,
      })
      toast.success('ATS charge sheet created')
      setValues(initial)
      setDueDate('')
      setNotes('')
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not create ATS entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1380px] px-8 py-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="font-display text-[32px] font-bold text-[#00450d]">ATS Charge Sheet</h1>
            <p className="text-slate-500">Account tracking, outstanding monitoring, and settlement control.</p>
          </div>
          <div className="flex gap-3">
            <button className="rounded border border-slate-300 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20]">Export Report</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            ['Total Pending', rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), '#1b5e20'],
            ['Critical (90+ Days)', 0, '#dc2626'],
            ['Warning (30-90 Days)', 0, '#f59e0b'],
            ['Healthy', healthyCount, '#16a34a'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded border border-slate-200 bg-white p-4 shadow-sm border-l-4" style={{ borderLeftColor: String(color) }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
              <p className="mt-1 font-mono text-[26px] font-bold" style={{ color: String(color) }}>{typeof value === 'number' && label === 'Total Pending' ? `Rs ${value.toLocaleString('en-IN')}` : value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-4">
            <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
              <div className="bg-[#1b5e20] px-6 py-3 text-white font-bold tracking-wider text-sm">Active Charge Sheet Records</div>
              <table className="w-full text-left">
                <thead className="bg-slate-100">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-700">
                    <th className="px-6 py-3">Customer Name</th>
                    <th className="px-4 py-3">Vehicle ID</th>
                    <th className="px-4 py-3 text-right">Due Amount</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-6 py-4 font-semibold">{row.customer?.name ?? '-'}</td>
                      <td className="px-4 py-4 font-mono text-sm text-slate-600">{row.vehicle?.code ?? '-'}</td>
                      <td className="px-4 py-4 text-right font-mono font-bold">Rs {Number(row.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-4">{row.due || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <span className={`h-3 w-3 rounded-full ${row.status === 'Complete' ? 'bg-green-500' : 'bg-[#1b5e20]'}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-4 space-y-6">
            <div className="rounded border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-l-4 border-[#1b5e20] p-6">
                <h2 className="font-display text-[24px] font-semibold text-[#00450d]">New ATS Entry</h2>
                <p className="mt-1 text-sm text-slate-500">Update customer charge status from a closed accounts deal.</p>
                <div className="mt-5 space-y-4">
                  <label className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Closed Accounts Deal</span>
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]">
                      {accountRows.map((row) => <option key={row.id} value={row.id}>{row.vehicle?.code} - {row.customer?.name}</option>)}
                    </select>
                  </label>
                  {Object.entries(values).map(([key, value]) => (
                    <label key={key} className="space-y-1 block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{key}</span>
                      <input value={value} onChange={(e) => setValues((current) => ({ ...current, [key]: key === 'Approver' ? e.target.value : e.target.value.replace(/[^\d.]/g, '') }))} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                    </label>
                  ))}
                  <label className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Due Date</span>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Internal Notes</span>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#1b5e20]" />
                  </label>
                </div>
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-[#e6e9e0] p-5 text-sm text-slate-700">
              Any due exceeding 90 days should trigger a service block on the customer profile. Current frontend shows the charge state; the persistence now flows through the ATS record in the live DB.
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600" /> Service Blocked</span>
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#f59e0b]" /> Collection Warning</span>
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500" /> Payment Clear</span>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate('/accounts')} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">Back</button>
          <button onClick={() => navigate('/dashboard')} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">Back to Dashboard</button>
          <button onClick={submit} disabled={loading} className="rounded bg-[#1b5e20] px-8 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
