import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type Vehicle = {
  id: string
  code: string
  model: string
  status: string
  customer?: { id: string; name: string; mobile: string } | null
}

type Row = {
  id: string
  status: string
  amount?: number | null
  due: string
  payload?: string | null
  vehicle?: Vehicle | null
  customer?: { name: string; mobile: string } | null
}

type LocalUpload = {
  fileName: string
  previewUrl: string
}

type Employee = {
  id: string
  name: string
  role: string
}

function parsePayload(payload?: string | null) {
  try { return payload ? JSON.parse(payload) : {} } catch { return {} }
}

const initial = {
  'Deal Value': '',
  'Closed Value': '',
  Balance: '',
  'Account Details': '',
  'Handled By': '',
}

const initialAts = {
  'ATS Status': 'Called',
  'Amount Paid': '',
  'Expected Closure Date': '',
  'Communication Mode': 'Phone Call',
  Remarks: '',
}

const fallbackEmployees: Employee[] = [
  { id: 'owner', name: 'Owner User', role: 'owner' },
  { id: 'admin', name: 'Admin User', role: 'admin' },
  { id: 'accounts', name: 'Accounts User', role: 'accounts' },
]

export default function Accounts() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const [rows, setRows] = useState<Row[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [employees, setEmployees] = useState<Employee[]>(fallbackEmployees)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [values, setValues] = useState(initial)
  const [atsValues, setAtsValues] = useState(initialAts)
  const [atsRows, setAtsRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [atsLoading, setAtsLoading] = useState(false)
  const [editUnlocked, setEditUnlocked] = useState(false)

  const load = async () => {
    const [rowRes, vehicleRes, userRes, atsRes] = await Promise.allSettled([api.get('/modules/accounts/work-items'), api.get('/vehicles'), api.get('/users'), api.get('/modules/ats/work-items')])
    const rowData = rowRes.status === 'fulfilled' ? rowRes.value.data : []
    const vehicleData = vehicleRes.status === 'fulfilled' ? vehicleRes.value.data : []
    setRows(rowData)
    if (atsRes.status === 'fulfilled') setAtsRows(atsRes.value.data)
    if (userRes.status === 'fulfilled') setEmployees(userRes.value.data.filter((user: Employee) => ['owner', 'admin', 'accounts', 'sales'].includes(user.role)))
    const eligible = vehicleData.filter((vehicle: Vehicle) => ['Insured', 'Financially Closed', 'Closed'].includes(vehicle.status) || vehicle.id === requestedVehicleId)
    setVehicles(eligible)
    if (requestedVehicleId && eligible.some((vehicle: Vehicle) => vehicle.id === requestedVehicleId)) {
      setSelectedVehicleId(requestedVehicleId)
    } else if (eligible[0]) {
      setSelectedVehicleId((current) => current || eligible[0].id)
    }
  }

  useEffect(() => { load().catch(() => toast.error('Could not load accounts data')) }, [requestedVehicleId])

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const currentRow = useMemo(() => rows.find((row) => row.vehicle?.id === selectedVehicleId) ?? null, [rows, selectedVehicleId])
  const currentPayload = useMemo(() => parsePayload(currentRow?.payload), [currentRow])
  const isFinalized = Boolean(currentRow)
  const isEditing = !isFinalized || editUnlocked
  const selectedAtsRows = useMemo(() => atsRows.filter((row) => row.vehicle?.id === selectedVehicleId), [atsRows, selectedVehicleId])

  const computedBalance = useMemo(() => {
    const dealValue = Number(values['Deal Value'] || 0)
    const closedValue = Number(values['Closed Value'] || 0)
    return Math.max(0, dealValue - closedValue)
  }, [values])

  useEffect(() => {
    setValues((current) => ({ ...current, Balance: String(computedBalance) }))
  }, [computedBalance])

  useEffect(() => {
    setEditUnlocked(false)
    if (!currentRow) {
      setValues({ ...initial, 'Handled By': employees[0]?.name ?? '' })
      return
    }
    setValues({
      'Deal Value': String(currentPayload['Deal Value'] ?? currentPayload['Total Deal Value'] ?? ''),
      'Closed Value': String(currentPayload['Closed Value'] ?? ''),
      Balance: String(currentPayload.Balance ?? currentPayload['Final Balance'] ?? ''),
      'Account Details': String(currentPayload['Account Details'] ?? ''),
      'Handled By': String(currentPayload['Handled By'] ?? employees[0]?.name ?? ''),
    })
  }, [currentRow, currentPayload, selectedVehicleId, employees])

  const totals = rows.reduce((acc, row) => {
    const payload = parsePayload(row.payload)
    const dealValue = Number(payload['Deal Value'] || payload['Total Deal Value'] || 0)
    const closedValue = Number(payload['Closed Value'] || 0)
    const balance = Number(payload.Balance || payload['Final Balance'] || 0)
    acc.deal += dealValue
    acc.collected += closedValue
    acc.pending += balance
    return acc
  }, { deal: 0, collected: 0, pending: 0 })

  const submit = async () => {
    if (!selectedVehicle) return toast.error('Select a deal vehicle first')
    if (!values['Deal Value'] || !values['Closed Value'] || !values['Handled By']) return toast.error('Complete deal value, closed value, and handled by')
    setLoading(true)
    try {
      const nextPayload = {
        ...values,
        'Vehicle Code': selectedVehicle.code,
        'Customer Name': selectedVehicle.customer?.name ?? '',
        'Customer Ledger': `${selectedVehicle.code}-LEDGER`,
        'Total Deal Value': values['Deal Value'],
        'Final Balance': values.Balance,
      }
      if (currentRow?.id) {
        await api.patch(`/work-items/${currentRow.id}/payload`, nextPayload)
      } else {
        await api.post('/modules/accounts/work-items', nextPayload)
      }
      await load()
      setEditUnlocked(false)
      toast.success('Accounts settlement recorded and locked')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not save accounts deal')
    } finally {
      setLoading(false)
    }
  }

  const addAtsFollowUp = async () => {
    if (!selectedVehicle) return toast.error('Select a deal vehicle first')
    if (!currentRow) return toast.error('Finalize account settlement before adding ATS')
    if (!atsValues['Amount Paid'] || !atsValues['Expected Closure Date']) return toast.error('Enter amount paid and expected closure date')
    setAtsLoading(true)
    try {
      await api.post('/modules/ats/work-items', {
        'Vehicle Code': selectedVehicle.code,
        'Deal ID': currentRow.id,
        'Customer Ledger': `${selectedVehicle.code}-LEDGER`,
        'Customer Name': selectedVehicle.customer?.name ?? '',
        'Customer Mobile': selectedVehicle.customer?.mobile ?? '',
        'Vehicle Model': selectedVehicle.model,
        'Balance': values.Balance,
        ...atsValues,
        'Net Settlement': values.Balance,
        'Due Date': atsValues['Expected Closure Date'],
      })
      setAtsValues(initialAts)
      await load()
      toast.success('ATS follow-up row added')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not add ATS follow-up')
    } finally {
      setAtsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1380px] px-8 py-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['Total Deal Value', totals.deal, '#1b5e20'],
            ['Total Collected', totals.collected, '#15803d'],
            ['Total Pending', totals.pending, '#dc2626'],
          ].map(([label, value, color]) => (
            <div key={label} className="bg-white p-5 shadow-sm border-l-4" style={{ borderLeftColor: String(color) }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
              <div className="mt-2 font-mono text-[30px] font-bold" style={{ color: String(color) }}>Rs {Number(value).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="bg-[#1b5e20] p-4 text-white font-display text-[20px]">Pending Accounts</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[#1b5e20] text-[11px] uppercase tracking-widest text-white">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const payload = parsePayload(row.payload)
                    return (
                      <tr key={row.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{row.customer?.name ?? '-'}</div>
                          <div className="text-xs text-slate-500">{row.customer?.mobile ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{row.vehicle?.model ?? '-'}</div>
                          <div className="font-mono text-xs text-slate-500">{row.vehicle?.code ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-red-600">Rs {Number(payload.Balance || payload['Final Balance'] || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="font-display text-[24px] font-semibold text-[#00450d]">Active Deal Settlement</h2>
                <p className="text-xs text-slate-500 mt-1">Create the deal closure record that drives ATS.</p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Selected Vehicle</p>
                <p className="font-mono text-sm">{selectedVehicle?.code ?? '-'}</p>
                <span className={`inline-flex rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isFinalized ? 'bg-[#1b5e20] text-white' : 'bg-amber-100 text-amber-900'}`}>
                  {isFinalized ? 'Settlement Locked' : 'Settlement Open'}
                </span>
                {isFinalized ? (
                  <div>
                    <button onClick={() => setEditUnlocked((value) => !value)} className="rounded border border-[#1b5e20] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                      {isEditing ? 'Close Edit' : 'Edit Settlement'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Vehicle</span>
                  <select value={selectedVehicleId} disabled={!isEditing} onChange={(e) => setSelectedVehicleId(e.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500">
                    {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} - {vehicle.model}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-[10px] uppercase tracking-widest text-slate-400">Customer</div><div className="mt-1 font-medium">{selectedVehicle?.customer?.name ?? '-'}</div></div>
                  <div><div className="text-[10px] uppercase tracking-widest text-slate-400">Phone</div><div className="mt-1 font-mono">{selectedVehicle?.customer?.mobile ?? '-'}</div></div>
                  <div className="col-span-2"><div className="text-[10px] uppercase tracking-widest text-slate-400">Vehicle Model</div><div className="mt-1">{selectedVehicle?.model ?? '-'}</div></div>
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Account Details</h3>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">Handled By</span>
                  <select
                    value={values['Handled By']}
                    disabled={!isEditing}
                    onChange={(event) => setValues((current) => ({ ...current, 'Handled By': event.target.value }))}
                    className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.name}>{employee.name} - {employee.role}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">Account Details</span>
                  <textarea
                    value={values['Account Details']}
                    readOnly={!isEditing}
                    onChange={(event) => setValues((current) => ({ ...current, 'Account Details': event.target.value }))}
                    className="h-32 w-full rounded border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#1b5e20] read-only:bg-slate-50 read-only:text-slate-500"
                    placeholder="Bank, ledger, receipt, or settlement notes..."
                  />
                </label>
              </div>

              <div className="space-y-3">
                {(['Deal Value', 'Closed Value', 'Balance'] as const).map((field) => (
                  <label key={field} className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500">{field}</span>
                    <input
                      type="text"
                      value={values[field]}
                      onChange={(e) => setValues((current) => ({ ...current, [field]: field.includes('Date') ? e.target.value : e.target.value.replace(/[^\d.]/g, '') }))}
                      readOnly={!isEditing || field === 'Balance'}
                      className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] read-only:bg-slate-100 read-only:text-slate-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {Number(values.Balance || 0) > 0 ? (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Advance Tracking Sheet</p>
                <h2 className="mt-1 font-display text-[24px] font-semibold text-[#00450d]">ATS opened for pending balance</h2>
                <p className="mt-1 text-sm text-slate-600">Balance is Rs {Number(values.Balance || 0).toLocaleString('en-IN')}. Track this advance before final closure.</p>
              </div>
              <button onClick={() => navigate(`/ats${selectedVehicleId ? `?vehicleId=${selectedVehicleId}` : ''}`)} className="rounded bg-[#1b5e20] px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-white">
                Open ATS
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {[
                ['Vehicle', selectedVehicle?.code ?? '-'],
                ['Customer', selectedVehicle?.customer?.name ?? '-'],
                ['Handled By', values['Handled By'] || '-'],
                ['Balance', `Rs ${Number(values.Balance || 0).toLocaleString('en-IN')}`],
              ].map(([label, value]) => (
                <div key={label} className="border border-amber-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
                  <p className="mt-1 font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 border border-amber-200 bg-white p-4">
              <h3 className="font-display text-[18px] font-semibold text-[#00450d]">Add ATS Follow-up</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ATS Status</span>
                  <select value={atsValues['ATS Status']} onChange={(event) => setAtsValues((current) => ({ ...current, 'ATS Status': event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]">
                    <option>Called</option>
                    <option>Promised</option>
                    <option>Part Paid</option>
                    <option>Closed</option>
                    <option>Not Responding</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">How Much Paid</span>
                  <input value={atsValues['Amount Paid']} onChange={(event) => setAtsValues((current) => ({ ...current, 'Amount Paid': event.target.value.replace(/[^\d.]/g, '') }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">When It Will Close</span>
                  <input type="date" value={atsValues['Expected Closure Date']} onChange={(event) => setAtsValues((current) => ({ ...current, 'Expected Closure Date': event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Way of Communication</span>
                  <select value={atsValues['Communication Mode']} onChange={(event) => setAtsValues((current) => ({ ...current, 'Communication Mode': event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]">
                    <option>Phone Call</option>
                    <option>WhatsApp</option>
                    <option>SMS</option>
                    <option>In Person</option>
                    <option>Email</option>
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2 xl:col-span-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Remarks</span>
                  <input value={atsValues.Remarks} onChange={(event) => setAtsValues((current) => ({ ...current, Remarks: event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={addAtsFollowUp} disabled={atsLoading || !currentRow} className="rounded bg-[#1b5e20] px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
                  {atsLoading ? 'Adding...' : 'Add ATS Row'}
                </button>
              </div>
              {selectedAtsRows.length ? (
                <div className="mt-5 overflow-hidden border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1b5e20] text-[10px] uppercase tracking-widest text-white">
                      <tr>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2">Close Date</th>
                        <th className="px-3 py-2">Communication</th>
                        <th className="px-3 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAtsRows.map((row, index) => {
                        const payload = parsePayload(row.payload)
                        return (
                          <tr key={row.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="px-3 py-2 font-semibold">{payload['ATS Status'] || row.status}</td>
                            <td className="px-3 py-2 text-right font-mono">Rs {Number(payload['Amount Paid'] || 0).toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2">{payload['Expected Closure Date'] || row.due || '-'}</td>
                            <td className="px-3 py-2">{payload['Communication Mode'] || '-'}</td>
                            <td className="px-3 py-2">{payload.Remarks || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
        <div className="text-xs text-slate-400">{isFinalized ? 'Accounts settlement is locked after submit until Edit Settlement is pressed.' : 'All changes are saved into live DB records.'}</div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/insurance')} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">Back</button>
          <button onClick={() => navigate('/ats')} disabled={!isFinalized} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">Next Step</button>
          <button onClick={submit} disabled={loading || !isEditing} className="rounded bg-[#1b5e20] px-10 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
            {loading ? 'Saving...' : isFinalized && !isEditing ? 'Settlement Locked' : 'Finalize Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}
