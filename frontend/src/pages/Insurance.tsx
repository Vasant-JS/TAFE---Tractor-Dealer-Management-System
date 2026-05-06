import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type Vehicle = {
  id: string
  code: string
  model: string
  status: string
  customer?: { name: string; mobile: string } | null
}

type Row = {
  id: string
  status: string
  due: string
  amount?: number | null
  payload?: string | null
  vehicle?: Vehicle | null
  customer?: { name: string; mobile: string } | null
}

const INSURANCE_COMPANIES_KEY = 'insurance-master-companies'
const INSURANCE_POLICY_TYPES_KEY = 'insurance-master-policy-types'
const defaultInsuranceCompanies = ['ICICI Lombard', 'HDFC ERGO', 'New India Assurance']
const defaultPolicyTypes = ['Comprehensive', 'Third Party Only', 'Zero Dep']

const initial = {
  'Policy Number': '',
  Provider: 'ICICI Lombard',
  'Premium Amount': '',
  'Start Date': '',
  'End Date': '',
  Nominee: '',
  'Nominee Relationship': '',
  'Nominee Age': '',
  'Coverage Type': 'Comprehensive',
}

function parsePayload(payload?: string | null) {
  try { return payload ? JSON.parse(payload) : {} } catch { return {} }
}

export default function Insurance() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const [rows, setRows] = useState<Row[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [values, setValues] = useState(initial)
  const [insuranceCompanies, setInsuranceCompanies] = useState<string[]>(defaultInsuranceCompanies)
  const [policyTypes, setPolicyTypes] = useState<string[]>(defaultPolicyTypes)
  const [loading, setLoading] = useState(false)
  const [editUnlocked, setEditUnlocked] = useState(false)

  const loadMasters = () => {
    try {
      const companies = JSON.parse(localStorage.getItem(INSURANCE_COMPANIES_KEY) || 'null')
      const policyTypesValue = JSON.parse(localStorage.getItem(INSURANCE_POLICY_TYPES_KEY) || 'null')
      const nextCompanies = Array.isArray(companies) && companies.length ? companies : defaultInsuranceCompanies
      const nextPolicyTypes = Array.isArray(policyTypesValue) && policyTypesValue.length ? policyTypesValue : defaultPolicyTypes
      setInsuranceCompanies(nextCompanies)
      setPolicyTypes(nextPolicyTypes)
      setValues((current) => ({
        ...current,
        Provider: nextCompanies.includes(current.Provider) ? current.Provider : nextCompanies[0],
        'Coverage Type': nextPolicyTypes.includes(current['Coverage Type']) ? current['Coverage Type'] : nextPolicyTypes[0],
      }))
    } catch {
      setInsuranceCompanies(defaultInsuranceCompanies)
      setPolicyTypes(defaultPolicyTypes)
    }
  }

  const load = async () => {
    const [rowRes, vehicleRes] = await Promise.all([api.get('/modules/insurance/work-items'), api.get('/vehicles')])
    setRows(rowRes.data)
    const eligible = vehicleRes.data.filter((vehicle: Vehicle) => ['Safety Acknowledged', 'Insured', 'RTO Verification In Progress', 'RTO Filed', 'Financially Closed', 'Closed'].includes(vehicle.status))
    setVehicles(eligible)
    if (requestedVehicleId && eligible.some((vehicle: Vehicle) => vehicle.id === requestedVehicleId)) {
      setSelectedVehicleId(requestedVehicleId)
    } else if (eligible[0]) {
      setSelectedVehicleId((current) => current || eligible[0].id)
    }
  }

  useEffect(() => {
    loadMasters()
    load().catch(() => toast.error('Could not load insurance data'))
    const onFocus = () => loadMasters()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [requestedVehicleId])

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const currentRow = useMemo(() => rows.find((row) => row.vehicle?.id === selectedVehicleId) ?? null, [rows, selectedVehicleId])
  const payload = useMemo(() => parsePayload(currentRow?.payload), [currentRow])
  const isFinalized = Boolean(currentRow)
  const isEditing = !isFinalized || editUnlocked

  useEffect(() => {
    setEditUnlocked(false)
    if (!currentRow) {
      setValues({
        ...initial,
        Provider: insuranceCompanies[0] ?? initial.Provider,
        'Coverage Type': policyTypes[0] ?? initial['Coverage Type'],
      })
      return
    }
    setValues({
      'Policy Number': String(payload['Policy Number'] ?? ''),
      Provider: String(payload['Provider'] ?? insuranceCompanies[0] ?? initial.Provider),
      'Premium Amount': String(payload['Premium Amount'] ?? ''),
      'Start Date': String(payload['Start Date'] ?? ''),
      'End Date': String(payload['End Date'] ?? ''),
      Nominee: String(payload['Nominee'] ?? ''),
      'Nominee Relationship': String(payload['Nominee Relationship'] ?? ''),
      'Nominee Age': String(payload['Nominee Age'] ?? ''),
      'Coverage Type': String(payload['Coverage Type'] ?? policyTypes[0] ?? initial['Coverage Type']),
    })
  }, [currentRow, payload, selectedVehicleId, insuranceCompanies, policyTypes])

  const submit = async () => {
    if (!selectedVehicle) return toast.error('Select a vehicle first')
    if (!values['Policy Number'] || !values['Start Date'] || !values['End Date'] || !values['Premium Amount']) return toast.error('Complete policy details first')
    setLoading(true)
    try {
      const nextPayload = {
        ...values,
        'Vehicle Code': selectedVehicle.code,
      }
      if (currentRow?.id) {
        await api.patch(`/work-items/${currentRow.id}/payload`, nextPayload)
      } else {
        await api.post('/modules/insurance/work-items', nextPayload)
      }
      await load()
      setEditUnlocked(false)
      toast.success('Policy recorded and locked')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not record insurance policy')
    } finally {
      setLoading(false)
    }
  }

  const activeCount = rows.filter((row) => row.status === 'Complete').length
  const expiringCount = rows.filter((row) => row.due).length

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1360px] px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="font-display text-[28px] font-bold text-[#00450d]">Insurance Management</h1>
            <p className="text-slate-500">Manage renewals, new policies, and documentation for dealership vehicles.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-3">
              {[
                ['Active Policies', activeCount.toString(), 'green'],
                ['Expiring', expiringCount.toString(), 'amber'],
                ['Expired', '0', 'red'],
              ].map(([label, value, tone]) => (
                <div key={label} className="min-w-[150px] border-l-4 bg-white px-5 py-4 shadow-sm" style={{ borderLeftColor: tone === 'green' ? '#16a34a' : tone === 'amber' ? '#f59e0b' : '#dc2626' }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[#00450d]">{value}</div>
                </div>
              ))}
            </div>
            <span className={`rounded px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${isFinalized ? 'bg-[#1b5e20] text-white' : 'bg-amber-100 text-amber-900'}`}>
              {isFinalized ? 'Insurance Locked' : 'Insurance In Progress'}
            </span>
            {isFinalized ? (
              <button onClick={() => setEditUnlocked((value) => !value)} className="rounded border border-[#1b5e20] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20]">
                {isEditing ? 'Close Edit' : 'Edit Policy'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button className="bg-[#1b5e20] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white">All Policies</button>
                <button className="border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Expiring Soon</button>
              </div>
            </div>
            <div className="overflow-hidden rounded border border-slate-200 bg-white">
              <table className="w-full text-left">
                <thead className="bg-[#1b5e20] text-[11px] uppercase tracking-widest text-white">
                  <tr>
                    <th className="px-4 py-3">Customer Details</th>
                    <th className="px-4 py-3">Vehicle Info</th>
                    <th className="px-4 py-3">Policy & Vendor</th>
                    <th className="px-4 py-3">Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rowPayload = parsePayload(row.payload)
                    return (
                      <tr key={row.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{row.customer?.name ?? '-'}</div>
                          <div className="text-xs text-slate-500">{row.customer?.mobile ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs">{row.vehicle?.code ?? '-'}</div>
                          <div className="text-xs text-slate-500">{row.vehicle?.model ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{rowPayload['Policy Number'] || '-'}</div>
                          <div className="text-xs text-slate-400">{rowPayload.Provider || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs">{rowPayload['End Date'] || '-'}</div>
                          <span className="mt-1 inline-block rounded-full bg-[#acf4a4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0c5216]">{row.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!rows.length ? <div className="p-5 text-sm text-slate-500">No insurance policies created yet.</div> : null}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="border-l-4 border-[#1b5e20] bg-white p-6 shadow-lg">
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="font-display text-[20px] font-semibold text-[#00450d]">Add New Policy</h3>
                <button onClick={() => navigate('/admin')} className="rounded border border-[#1b5e20] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                  Manage Masters
                </button>
              </div>
              <div className="rounded bg-[#ecefe6] p-4 flex gap-4 items-center">
                <div className="flex h-14 w-14 items-center justify-center border border-slate-200 bg-white">
                  <span className="material-symbols-outlined text-3xl text-[#1b5e20]">agriculture</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Target Vehicle</p>
                  <p className="text-sm font-semibold">{selectedVehicle?.model ?? 'Select Vehicle'}</p>
                  <p className="text-xs text-slate-500">{selectedVehicle?.customer?.name ?? ''}</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <label className="space-y-1 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Vehicle</span>
                  <select value={selectedVehicleId} disabled={!isEditing} onChange={(e) => setSelectedVehicleId(e.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500">
                    {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} - {vehicle.model}</option>)}
                  </select>
                </label>
                {Object.entries(values).map(([key, value]) => (
                  <label key={key} className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{key}</span>
                    {key === 'Provider' ? (
                      <select value={value} disabled={!isEditing} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500">
                        {insuranceCompanies.map((company) => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </select>
                    ) : key === 'Coverage Type' ? (
                      <select value={value} disabled={!isEditing} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500">
                        {policyTypes.map((policyType) => (
                          <option key={policyType} value={policyType}>{policyType}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={key.includes('Date') ? 'date' : 'text'}
                        value={value}
                        readOnly={!isEditing}
                        onChange={(e) =>
                          setValues((current) => ({
                            ...current,
                            [key]:
                              key === 'Premium Amount'
                                ? e.target.value.replace(/[^\d.]/g, '')
                                : key === 'Nominee Age'
                                  ? e.target.value.replace(/\D/g, '').slice(0, 3)
                                  : e.target.value,
                          }))
                        }
                        className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] read-only:bg-slate-50 read-only:text-slate-500"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
        <div className="text-xs text-slate-400">{isFinalized ? 'Insurance policy is locked after submit until Edit Policy is pressed.' : 'All changes are saved into live DB records.'}</div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/safety')} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">Back</button>
          <button onClick={() => navigate('/rto')} disabled={!isFinalized} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">Next Step</button>
          <button onClick={submit} disabled={loading || !isEditing} className="rounded bg-[#1b5e20] px-8 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
            {loading ? 'Saving...' : isFinalized && !isEditing ? 'Policy Locked' : 'Save & Issue Policy'}
          </button>
        </div>
      </div>
    </div>
  )
}
