import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api/client'

type Row = {
  id: string
  status: string
  amount?: number | null
  payload?: string | null
}

function parsePayload(payload?: string | null) {
  try { return payload ? JSON.parse(payload) : {} } catch { return {} }
}

const initial = {
  'Previous Owner': '',
  'Ownership Chain': '',
  'Loan / Hypothecation': '',
  Make: '',
  Model: '',
  Year: '',
  'Hours on Meter': '',
  'Offered Price': '',
  'Liquidation Target Price': '',
}

export default function Exchange() {
  const [rows, setRows] = useState<Row[]>([])
  const [values, setValues] = useState(initial)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const { data } = await api.get('/modules/exchange/work-items')
    setRows(data)
  }

  useEffect(() => { load().catch(() => toast.error('Could not load exchange records')) }, [])

  const submit = async () => {
    setLoading(true)
    try {
      await api.post('/modules/exchange/work-items', values)
      toast.success('Exchange registry entry created')
      setValues(initial)
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not create exchange record')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1360px] px-8 py-8 space-y-6">
        <div>
          <h1 className="font-display text-[30px] font-bold text-[#00450d]">Exchange Registry</h1>
          <p className="text-slate-500">Manage old tractor valuation, ownership history, and liquidation targets.</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 rounded border border-slate-200 bg-white shadow-sm">
            <div className="border-l-4 border-[#1b5e20] p-6">
              <h2 className="font-display text-[22px] font-semibold text-[#00450d]">Exchange Entries</h2>
              <div className="mt-5 overflow-hidden rounded border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-[#1b5e20] text-[11px] uppercase tracking-widest text-white">
                    <tr>
                      <th className="px-4 py-3">Previous Owner</th>
                      <th className="px-4 py-3">Machine</th>
                      <th className="px-4 py-3 text-right">Offered</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const payload = parsePayload(row.payload)
                      return (
                        <tr key={row.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                          <td className="px-4 py-3">{payload['Previous Owner'] || '-'}</td>
                          <td className="px-4 py-3">{payload.Make || '-'} {payload.Model || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono">Rs {Number(row.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3"><span className="rounded bg-[#ffdcc2] px-2 py-1 text-[10px] font-bold uppercase text-[#6d3a00]">{row.status}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {!rows.length ? <div className="p-5 text-sm text-slate-500">No exchange entries yet.</div> : null}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 rounded border border-slate-200 bg-white shadow-sm">
            <div className="border-l-4 border-[#1b5e20] p-6 space-y-4">
              <h2 className="font-display text-[22px] font-semibold text-[#00450d]">Record Exchange</h2>
              {Object.keys(values).map((field) => (
                <label key={field} className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">{field}</span>
                  <input
                    value={values[field as keyof typeof values]}
                    onChange={(e) => setValues((current) => ({ ...current, [field]: ['Year', 'Hours on Meter', 'Offered Price', 'Liquidation Target Price'].includes(field) ? e.target.value.replace(/[^\d.]/g, '') : e.target.value }))}
                    className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex justify-end gap-3 border-t border-slate-200 bg-white px-8 py-4">
        <button onClick={submit} disabled={loading} className="rounded bg-[#1b5e20] px-8 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
          {loading ? 'Saving...' : 'Record Exchange'}
        </button>
      </div>
    </div>
  )
}
