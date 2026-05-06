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

function parsePayload(payload?: string | null) {
  try { return payload ? JSON.parse(payload) : {} } catch { return {} }
}

const initial = {
  'Total Deal Value': '',
  'Booking Amount': '',
  'Loan Disbursal': '',
  'Cash Receipt': '',
  'Discount Approval': '',
  'Final Balance': '',
  'Deal Closure Date': '',
}

export default function Accounts() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const [rows, setRows] = useState<Row[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [values, setValues] = useState(initial)
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentProof, setPaymentProof] = useState<LocalUpload | null>(null)
  const [loading, setLoading] = useState(false)
  const [editUnlocked, setEditUnlocked] = useState(false)

  const load = async () => {
    const [rowRes, vehicleRes] = await Promise.all([api.get('/modules/accounts/work-items'), api.get('/vehicles')])
    setRows(rowRes.data)
    const eligible = vehicleRes.data.filter((vehicle: Vehicle) => ['RTO Verification In Progress', 'RTO Filed', 'Financially Closed', 'Closed'].includes(vehicle.status) || vehicle.id === requestedVehicleId)
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

  const computedFinalBalance = useMemo(() => {
    const totalDealValue = Number(values['Total Deal Value'] || 0)
    const booking = Number(values['Booking Amount'] || 0)
    const loan = Number(values['Loan Disbursal'] || 0)
    const cash = Number(values['Cash Receipt'] || 0)
    const discount = Number(values['Discount Approval'] || 0)
    return Math.max(0, totalDealValue - booking - loan - cash - discount)
  }, [values])

  useEffect(() => {
    setValues((current) => ({ ...current, 'Final Balance': String(computedFinalBalance) }))
  }, [computedFinalBalance])

  useEffect(() => {
    setEditUnlocked(false)
    if (!currentRow) {
      setValues(initial)
      setPaymentMode('Cash')
      setPaymentRef('')
      setPaymentProof((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
        return null
      })
      return
    }
    setValues({
      'Total Deal Value': String(currentPayload['Total Deal Value'] ?? ''),
      'Booking Amount': String(currentPayload['Booking Amount'] ?? ''),
      'Loan Disbursal': String(currentPayload['Loan Disbursal'] ?? ''),
      'Cash Receipt': String(currentPayload['Cash Receipt'] ?? ''),
      'Discount Approval': String(currentPayload['Discount Approval'] ?? ''),
      'Final Balance': String(currentPayload['Final Balance'] ?? ''),
      'Deal Closure Date': String(currentPayload['Deal Closure Date'] ?? ''),
    })
    setPaymentMode(String(currentPayload['Payment Mode'] ?? 'Cash'))
    setPaymentRef(String(currentPayload['Bank Reference'] ?? ''))
    const savedProofName = String(currentPayload['Payment Proof'] ?? '')
    setPaymentProof((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return savedProofName ? { fileName: savedProofName, previewUrl: '' } : null
    })
  }, [currentRow, currentPayload, selectedVehicleId])

  useEffect(() => {
    if (paymentMode === 'Cash') {
      setPaymentRef('')
      setPaymentProof((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
        return current?.fileName && !current.previewUrl ? current : null
      })
    }
  }, [paymentMode])

  const totals = rows.reduce((acc, row) => {
    const payload = parsePayload(row.payload)
    const collected = Number(payload['Booking Amount'] || 0) + Number(payload['Loan Disbursal'] || 0) + Number(payload['Cash Receipt'] || 0)
    const finalBalance = Number(payload['Final Balance'] || 0)
    acc.deal += collected + finalBalance
    acc.collected += collected
    acc.pending += finalBalance
    return acc
  }, { deal: 0, collected: 0, pending: 0 })

  const setPaymentProofUpload = (file?: File) => {
    if (!file) return
    setPaymentProof((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return {
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      }
    })
    toast.success(`${file.name} attached`)
  }

  const clearPaymentProof = () => {
    setPaymentProof((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }

  const viewPaymentProof = () => {
    if (!paymentProof?.previewUrl) {
      toast('Saved payment proof name is available, but only files attached in the current edit session can be previewed here.')
      return
    }
    window.open(paymentProof.previewUrl, '_blank', 'noopener,noreferrer')
  }

  const paymentDocumentLabel = useMemo(() => {
    if (paymentMode === 'Cheque') return 'Cheque Copy'
    if (paymentMode === 'DD') return 'Demand Draft Copy'
    if (paymentMode === 'Loan Disbursal') return 'Loan Document'
    if (paymentMode === 'Bank Transfer') return 'Bank Transfer Proof'
    return 'Payment Proof'
  }, [paymentMode])

  const submit = async () => {
    if (!selectedVehicle) return toast.error('Select a deal vehicle first')
    if (paymentMode !== 'Cash' && !paymentProof) return toast.error(`Upload the ${paymentDocumentLabel.toLowerCase()} before finalizing settlement`)
    setLoading(true)
    try {
      const nextPayload = {
        ...values,
        'Vehicle Code': selectedVehicle.code,
        'Customer Name': selectedVehicle.customer?.name ?? '',
        'Customer Ledger': `${selectedVehicle.code}-LEDGER`,
        'Payment Mode': paymentMode,
        'Bank Reference': paymentRef,
        'Payment Proof': paymentProof?.fileName ?? '',
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
                        <td className="px-4 py-3 text-right font-mono font-bold text-red-600">Rs {Number(payload['Final Balance'] || 0).toLocaleString('en-IN')}</td>
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
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Record New Payment</h3>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">Payment Mode</span>
                  <select value={paymentMode} disabled={!isEditing} onChange={(e) => setPaymentMode(e.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500">
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Cheque</option>
                    <option>DD</option>
                    <option>Loan Disbursal</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">Transaction Reference</span>
                  <input value={paymentRef} readOnly={!isEditing} onChange={(e) => setPaymentRef(e.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 font-mono text-sm outline-none focus:border-[#1b5e20] read-only:bg-slate-50 read-only:text-slate-500" />
                </label>
                {paymentMode !== 'Cash' ? (
                  <div className="rounded border border-slate-200 bg-white p-3 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{paymentDocumentLabel}</p>
                    <div className="text-sm text-slate-600">{paymentProof?.fileName ?? `Upload ${paymentDocumentLabel.toLowerCase()}`}</div>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <label className="cursor-pointer rounded border border-[#1b5e20] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                          <input type="file" accept=".pdf,image/*" className="hidden" onChange={(event) => setPaymentProofUpload(event.target.files?.[0])} />
                          {paymentProof ? 'Re-upload' : 'Upload Document'}
                        </label>
                        {paymentProof ? (
                          <>
                            <button type="button" onClick={viewPaymentProof} className="rounded border border-slate-300 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">View</button>
                            <button type="button" onClick={clearPaymentProof} className="rounded border border-red-300 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700">Remove</button>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Payment proof locked after submit
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {Object.keys(values).map((field) => (
                  <label key={field} className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500">{field}</span>
                    <input
                      type={field.includes('Date') ? 'date' : 'text'}
                      value={values[field as keyof typeof values]}
                      onChange={(e) => setValues((current) => ({ ...current, [field]: field.includes('Date') ? e.target.value : e.target.value.replace(/[^\d.]/g, '') }))}
                      readOnly={!isEditing || field === 'Final Balance'}
                      className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] read-only:bg-slate-100 read-only:text-slate-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
        <div className="text-xs text-slate-400">{isFinalized ? 'Accounts settlement is locked after submit until Edit Settlement is pressed.' : 'All changes are saved into live DB records.'}</div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/rto')} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">Back</button>
          <button onClick={() => navigate('/ats')} disabled={!isFinalized} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">Next Step</button>
          <button onClick={submit} disabled={loading || !isEditing} className="rounded bg-[#1b5e20] px-10 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
            {loading ? 'Saving...' : isFinalized && !isEditing ? 'Settlement Locked' : 'Finalize Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}
