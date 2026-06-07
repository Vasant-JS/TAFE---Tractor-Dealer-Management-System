import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type Row = {
  id: string
  status: string
  amount?: number | null
  due: string
  payload?: string | null
  vehicle?: { id?: string; code: string; model: string; chassisNo?: string | null; registrationNo?: string | null } | null
  customer?: { name: string; mobile?: string | null; address?: string | null } | null
}

function parsePayload(payload?: string | null) {
  try { return payload ? JSON.parse(payload) : {} } catch { return {} }
}

export default function ATSChargeSheet() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [selectedRowId, setSelectedRowId] = useState('')

  const load = async () => {
    const { data } = await api.get('/modules/ats/work-items')
    setRows(data)
    const requested = data.find((row: Row) => row.vehicle?.id === requestedVehicleId)
    setSelectedRowId((current) => current || requested?.id || data[0]?.id || '')
  }

  useEffect(() => { load().catch(() => toast.error('Could not load ATS records')) }, [requestedVehicleId])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => {
      const payload = parsePayload(row.payload)
      return [
        row.vehicle?.code,
        row.vehicle?.model,
        row.vehicle?.chassisNo,
        row.vehicle?.registrationNo,
        row.customer?.name,
        row.customer?.mobile,
        payload['Customer Name'],
        payload['Customer Mobile'],
        payload['Vehicle Model'],
      ].some((value) => String(value ?? '').toLowerCase().includes(needle))
    })
  }, [rows, query])

  const selectedRow = useMemo(() => filteredRows.find((row) => row.id === selectedRowId) ?? filteredRows[0] ?? null, [filteredRows, selectedRowId])
  const selectedPayload = useMemo(() => parsePayload(selectedRow?.payload), [selectedRow])
  const selectedVehicleCode = selectedRow?.vehicle?.code ?? selectedPayload['Vehicle Code'] ?? '-'
  const selectedCustomerName = selectedRow?.customer?.name ?? selectedPayload['Customer Name'] ?? '-'
  const selectedCustomerMobile = selectedRow?.customer?.mobile ?? selectedPayload['Customer Mobile'] ?? '-'

  const totalPending = rows.reduce((sum, row) => {
    const payload = parsePayload(row.payload)
    return sum + Number(payload.Balance || payload['Net Settlement'] || row.amount || 0)
  }, 0)
  const calledCount = rows.filter((row) => (parsePayload(row.payload)['ATS Status'] || '').toLowerCase() === 'called').length
  const closedCount = rows.filter((row) => (parsePayload(row.payload)['ATS Status'] || row.status).toLowerCase() === 'closed' || row.status === 'Complete').length

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1380px] space-y-6 px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[32px] font-bold text-[#00450d]">ATS Status</h1>
            <p className="text-slate-500">Search any vehicle or customer and review Advance Tracking Sheet follow-ups.</p>
          </div>
          <button onClick={() => navigate('/accounts')} className="rounded border border-[#1b5e20] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20]">
            Add ATS in Accounts
          </button>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ['Total Pending', `Rs ${totalPending.toLocaleString('en-IN')}`, '#1b5e20'],
            ['Called', calledCount, '#f59e0b'],
            ['Closed', closedCount, '#16a34a'],
          ].map(([label, value, color]) => (
            <div key={label} className="border-l-4 bg-white p-5 shadow-sm" style={{ borderLeftColor: String(color) }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
              <p className="mt-2 font-mono text-[26px] font-bold" style={{ color: String(color) }}>{value}</p>
            </div>
          ))}
        </section>

        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Search Vehicle / Customer / Mobile</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full border border-slate-200 px-4 text-sm outline-none focus:border-[#1b5e20]"
              placeholder="Search by vehicle code, model, customer name, or mobile number"
            />
          </label>
        </section>

        {selectedRow ? (
          <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              <div className="border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Contact Details</p>
                <h2 className="mt-2 text-xl font-semibold text-[#00450d]">{selectedCustomerName}</h2>
                <p className="mt-1 font-mono text-sm text-slate-700">{selectedCustomerMobile}</p>
                <p className="mt-2 text-sm text-slate-500">{selectedRow.customer?.address ?? selectedPayload['Customer Address'] ?? '-'}</p>
              </div>
              <div className="border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Vehicle Details</p>
                <h2 className="mt-2 text-xl font-semibold text-[#00450d]">{selectedVehicleCode}</h2>
                <p className="mt-1 text-sm text-slate-700">{selectedRow.vehicle?.model ?? selectedPayload['Vehicle Model'] ?? '-'}</p>
                <p className="mt-2 font-mono text-xs text-slate-500">Chassis: {selectedRow.vehicle?.chassisNo ?? '-'}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">Reg: {selectedRow.vehicle?.registrationNo ?? '-'}</p>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="bg-[#1b5e20] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white">ATS Follow-up Rows</div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3">Closure</th>
                    <th className="px-4 py-3">Communication</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => {
                    const payload = parsePayload(row.payload)
                    return (
                      <tr key={row.id} onClick={() => setSelectedRowId(row.id)} className={`cursor-pointer ${selectedRowId === row.id ? 'bg-green-50' : index % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="px-4 py-3">{row.customer?.name ?? payload['Customer Name'] ?? '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.vehicle?.code ?? payload['Vehicle Code'] ?? '-'}</td>
                        <td className="px-4 py-3 font-semibold">{payload['ATS Status'] || row.status}</td>
                        <td className="px-4 py-3 text-right font-mono">Rs {Number(payload['Amount Paid'] || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">{payload['Expected Closure Date'] || row.due || '-'}</td>
                        <td className="px-4 py-3">{payload['Communication Mode'] || '-'}</td>
                        <td className="px-4 py-3">{payload.Remarks || payload.Notes || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!filteredRows.length ? <div className="p-6 text-sm text-slate-500">No ATS rows match this search.</div> : null}
            </div>
          </section>
        ) : (
          <section className="border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">No ATS rows created yet. Add follow-ups from Accounts when a balance is pending.</section>
        )}
      </div>
    </div>
  )
}
