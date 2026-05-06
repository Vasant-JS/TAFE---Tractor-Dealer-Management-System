import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api/client'

type Vehicle = {
  id: string
  code: string
  model: string
  status: string
  chassisNo?: string | null
  engineNo?: string | null
  customer?: { name: string; mobile: string } | null
}

type Row = {
  id: string
  ref?: string
  status: string
  createdAt?: string
  updatedAt?: string
  payload?: string | null
  vehicle?: Vehicle | null
  customer?: { name: string; mobile: string } | null
}

type TechnicianOption = {
  id: string
  name: string
}

type FilterKey = 'all' | 'raised' | 'allocated' | 'scheduled' | 'completed'
type SourceKey = 'Periodic' | 'Customer' | 'Breakdown'

const initial = {
  'Complaint Number': '',
  'Issue Category': 'Periodic Service',
  Priority: 'Medium',
  Mechanic: '',
  'Visit Type': 'Workshop',
  'Spares Used': '',
}

function parsePayload(payload?: string | null) {
  try {
    return payload ? JSON.parse(payload) : {}
  } catch {
    return {}
  }
}

function toneForStatus(status: string) {
  const value = status.toLowerCase()
  if (value.includes('complete')) return 'bg-slate-900 text-white'
  if (value.includes('progress')) return 'bg-green-800 text-white'
  if (value.includes('schedule')) return 'bg-[#18223b] text-white'
  if (value.includes('raise')) return 'bg-[#a65a00] text-white'
  return 'bg-slate-200 text-slate-700'
}

function sourcePill(source: string) {
  const value = source.toLowerCase()
  if (value.includes('breakdown')) return 'bg-[#ff8f00] text-white'
  if (value.includes('periodic')) return 'bg-slate-100 text-slate-700'
  return 'bg-slate-100 text-slate-700'
}

function formatMoment(input?: string) {
  if (!input) return 'Pending actions'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ServiceManagement() {
  const [rows, setRows] = useState<Row[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedRowId, setSelectedRowId] = useState('')
  const [values, setValues] = useState(initial)
  const [searchVin, setSearchVin] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [estimatedDate, setEstimatedDate] = useState(new Date().toISOString().slice(0, 10))
  const [estimatedTime, setEstimatedTime] = useState('09:00')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [source, setSource] = useState<SourceKey>('Periodic')
  const [loading, setLoading] = useState(false)
  const [vehicleQuery, setVehicleQuery] = useState('')
  const [showVehicleMatches, setShowVehicleMatches] = useState(false)
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([])

  const load = async () => {
    const [rowRes, vehicleRes, userRes] = await Promise.all([api.get('/modules/service/work-items'), api.get('/vehicles'), api.get('/users')])
    setRows(rowRes.data)
    setAllVehicles(vehicleRes.data)
    setTechnicians((userRes.data ?? []).filter((user: any) => user.role === 'technician').map((user: any) => ({ id: user.id, name: user.name })))
    const eligibleStatuses = [
      'Delivered',
      'Safety Acknowledged',
      'Safety Completed',
      'Insured',
      'RTO Verification In Progress',
      'RTO Filed',
      'Financially Closed',
      'Closed',
      'Service In Progress',
      'ATS Generated',
    ]
    const eligible = vehicleRes.data.filter((vehicle: Vehicle) => eligibleStatuses.includes(vehicle.status))
    setVehicles(eligible)
    if (rowRes.data?.[0]) {
      setSelectedRowId((current) => current || rowRes.data[0].id)
    }
  }

  useEffect(() => {
    load().catch(() => toast.error('Could not load service records'))
  }, [])

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])

  useEffect(() => {
    if (!selectedVehicle) {
      setSearchVin('')
      setContactNumber('')
      return
    }
    setSearchVin(`VIN: ${selectedVehicle.chassisNo ?? selectedVehicle.code}`)
    setContactNumber(selectedVehicle.customer?.mobile ?? '')
  }, [selectedVehicle])

  const vehicleMatches = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase()
    const sourceList = query ? allVehicles : vehicles
    const matches = sourceList
      .filter((vehicle) => {
        const haystack = [
          vehicle.code,
          vehicle.model,
          vehicle.chassisNo ?? '',
          vehicle.engineNo ?? '',
          vehicle.customer?.name ?? '',
          vehicle.customer?.mobile ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 8)
    if (!query) return matches.slice(0, 6)
    return matches
  }, [allVehicles, vehicles, vehicleQuery])

  const applyVehicleSelection = (vehicle: Vehicle) => {
    setSelectedVehicleId(vehicle.id)
    setVehicleQuery(vehicle.customer?.name ?? vehicle.model ?? vehicle.code)
    setSearchVin(`VIN: ${vehicle.chassisNo ?? vehicle.code}`)
    setContactNumber(vehicle.customer?.mobile ?? '')
    setShowVehicleMatches(false)
    setValues((current) => ({
      ...current,
      'Complaint Number': current['Complaint Number'] || `SR-${new Date().getFullYear()}-${vehicle.code.split('-').slice(-1)[0] ?? Math.floor(Math.random() * 9000 + 1000)}`,
    }))
  }

  const runVehicleSearch = () => {
    const first = vehicleMatches[0]
    if (!first) {
      toast.error('No customer or vehicle match found')
      return
    }
    if (!vehicles.some((vehicle) => vehicle.id === first.id)) {
      toast.error('This vehicle is not yet eligible for service workflow')
      return
    }
    applyVehicleSelection(first)
    toast.success(`Loaded ${first.model}`)
  }

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => {
        const payload = parsePayload(row.payload)
        const issueCategory = String(payload['Issue Category'] ?? payload['Source of Request'] ?? 'Customer')
        const visitType = String(payload['Visit Type'] ?? 'Workshop')
        const mechanic = String(payload['Mechanic'] ?? '')
        return {
          ...row,
          payloadMap: payload,
          complaintNumber: String(payload['Complaint Number'] ?? row.ref ?? row.id),
          source: issueCategory,
          visitType,
          mechanic,
        }
      }),
    [rows],
  )

  const filteredRows = useMemo(() => {
    return normalizedRows.filter((row: any) => {
      const status = String(row.status ?? '').toLowerCase()
      if (filter === 'raised') return status.includes('raised')
      if (filter === 'allocated') return status.includes('allocated') || Boolean(row.mechanic)
      if (filter === 'scheduled') return status.includes('scheduled')
      if (filter === 'completed') return status.includes('complete')
      return true
    })
  }, [normalizedRows, filter])

  const selectedRow = useMemo(() => filteredRows.find((row: any) => row.id === selectedRowId) ?? normalizedRows[0] ?? null, [filteredRows, normalizedRows, selectedRowId])

  useEffect(() => {
    if (selectedRow?.id) setSelectedRowId(selectedRow.id)
  }, [selectedRow?.id])

  const activeWorkshops = vehicles.filter((vehicle) => ['Service In Progress', 'Closed'].includes(vehicle.status)).length || 12
  const pendingAllocations = normalizedRows.filter((row: any) => !row.mechanic || String(row.status).toLowerCase().includes('raised')).length
  const criticalBreakdowns = normalizedRows.filter((row: any) => String(row.source).toLowerCase().includes('breakdown')).length
  const completedToday = normalizedRows.filter((row) => String(row.status).toLowerCase().includes('complete')).length

  const saveDraft = () => {
    toast.success('Draft saved locally. Generate Service ID when ready.')
  }

  const exportLogs = () => {
    const header = ['SR Number', 'Customer', 'Vehicle', 'Source', 'Service Type', 'Assigned To', 'Status']
    const lines = filteredRows.map((row: any) =>
      [row.complaintNumber, row.customer?.name ?? '', row.vehicle?.model ?? '', row.source, row.visitType, row.mechanic || 'Unallocated', row.status].join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'service-logs.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Service logs exported')
  }

  const submit = async () => {
    if (!selectedVehicle) return toast.error('Select a vehicle first')
    setLoading(true)
    try {
      await api.post('/modules/service/work-items', {
        ...values,
        'Vehicle Code': selectedVehicle.code,
        'Customer Name': selectedVehicle.customer?.name ?? '',
        'Complaint Notes': notes,
        'Estimated Date': estimatedDate,
        'Estimated Time': estimatedTime,
        'Source of Request': source,
        'Customer Mobile': contactNumber,
      })
      toast.success('Service ID generated')
      setValues(initial)
      setNotes('')
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not create service request')
    } finally {
      setLoading(false)
    }
  }

  const filterButtons: Array<[FilterKey, string]> = [
    ['all', `All Requests`],
    ['raised', `Raised (${normalizedRows.filter((row: any) => String(row.status).toLowerCase().includes('raised')).length.toString().padStart(2, '0')})`],
    ['allocated', `Allocated (${normalizedRows.filter((row: any) => row.mechanic).length.toString().padStart(2, '0')})`],
    ['scheduled', `Scheduled (${normalizedRows.filter((row: any) => String(row.status).toLowerCase().includes('scheduled')).length.toString().padStart(2, '0')})`],
    ['completed', 'Completed'],
  ]

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1400px] space-y-8 px-8 py-8">
        <section className="border-b-2 border-slate-900 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="font-display text-[32px] font-normal text-[#191d17]">Service Operations</h1>
              <p className="text-[16px] text-[#717a6d]">Manage maintenance cycles, breakdown repairs, and field service schedules.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={exportLogs} className="flex items-center gap-2 border border-slate-900 bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-800 hover:bg-slate-50">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export Logs
              </button>
              <button
                onClick={() => {
                  const target = document.getElementById('new-service-request')
                  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="flex items-center gap-2 bg-[#1b5e20] px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-white hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Service Request
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ['Active Workshops', activeWorkshops, '84% Capacity', '#1b5e20', 'trending_up'],
            ['Pending Allocations', pendingAllocations, 'Requires urgent assignment', '#8f4e00', ''],
            ['Critical Breakdowns', criticalBreakdowns, 'Technician en route', '#ba1a1a', ''],
            ['Completed Today', completedToday, 'Invoicing in progress', '#1b5e20', ''],
          ].map(([label, value, note, color, icon]) => (
            <div key={label} className="bg-white p-4 shadow-sm border-l-4" style={{ borderLeftColor: String(color) }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">{label}</p>
              <h3 className="mt-1 font-display text-[28px] font-medium" style={{ color: String(color) }}>{String(value).padStart(2, '0')}</h3>
              <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: String(color) }}>
                {icon ? <span className="material-symbols-outlined text-[14px]">{icon}</span> : null}
                <span className="font-mono">{note}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filterButtons.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] ${
                  filter === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden border border-slate-200 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#1b5e20] text-white">
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider border-r border-green-800">SR Number</th>
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider border-r border-green-800">Customer</th>
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider border-r border-green-800">Vehicle</th>
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider border-r border-green-800">Source</th>
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider border-r border-green-800">Service Type</th>
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider border-r border-green-800">Assigned To</th>
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row: any, index) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRowId(row.id)}
                    className={`${index % 2 ? 'bg-[#f4f4f2]' : 'bg-white'} cursor-pointer transition-colors hover:bg-[#f2f5ec] ${selectedRow?.id === row.id ? 'ring-1 ring-inset ring-[#1b5e20]' : ''}`}
                  >
                    <td className="p-3 font-mono text-[14px] font-bold text-green-900">{row.complaintNumber}</td>
                    <td className="p-3 text-[14px] font-semibold text-[#191d17]">{row.customer?.name ?? '-'}</td>
                    <td className="p-3 text-[14px] text-[#191d17]">{row.vehicle?.model ?? '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${sourcePill(row.source)}`}>{row.source}</span>
                    </td>
                    <td className="p-3 text-[13px]">{row.visitType}</td>
                    <td className="p-3">
                      {row.mechanic ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                            {row.mechanic
                              .split(' ')
                              .map((part: string) => part[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="text-[13px]">{row.mechanic}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#717a6d]">
                          <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                          <span className="text-[13px]">Unallocated</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${toneForStatus(row.status)}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? <div className="p-5 text-sm text-slate-500">No service requests for this filter yet.</div> : null}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-3" id="new-service-request">
          <div className="space-y-6 lg:col-span-2">
            <div className="border-l-4 border-[#1b5e20] bg-white p-8 shadow-sm">
              <div className="mb-8 flex items-center gap-4">
                <div className="h-1 flex-1 bg-[#1b5e20]" />
                <div className="h-1 flex-1 bg-[#1b5e20]" />
                <div className="h-1 flex-1 bg-slate-200" />
                <div className="h-1 flex-1 bg-slate-200" />
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="mb-4 flex items-center gap-2 font-display text-[20px] font-medium text-[#191d17]">
                    <span className="flex h-6 w-6 items-center justify-center bg-slate-900 text-[10px] font-bold text-white">01</span>
                    Identity &amp; Origin
                  </h3>
                  <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">Search Customer / Vehicle VIN</label>
                      <div className="relative">
                        <input
                          value={vehicleQuery}
                          onChange={(event) => {
                            setVehicleQuery(event.target.value)
                            setShowVehicleMatches(true)
                          }}
                          onFocus={() => setShowVehicleMatches(true)}
                          onBlur={() => {
                            window.setTimeout(() => setShowVehicleMatches(false), 150)
                          }}
                          placeholder="Search customer name, vehicle code, model, or chassis"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              runVehicleSearch()
                            }
                          }}
                          className="w-full border-b border-slate-300 p-2 text-[14px] outline-none focus:border-[#1b5e20]"
                        />
                        <button type="button" onClick={runVehicleSearch} className="absolute right-2 top-2 text-[#1b5e20]">
                          <span className="material-symbols-outlined">search</span>
                        </button>
                        {vehicleQuery && showVehicleMatches ? (
                          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto border border-slate-200 bg-white shadow-lg">
                            {vehicleMatches.length ? (
                              vehicleMatches.map((vehicle) => (
                                <button
                                  key={vehicle.id}
                                  type="button"
                                  onClick={() => {
                                    if (!vehicles.some((eligible) => eligible.id === vehicle.id)) {
                                      toast.error('This vehicle is not yet eligible for service workflow')
                                      return
                                    }
                                    applyVehicleSelection(vehicle)
                                  }}
                                  className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left hover:bg-[#f2f5ec] ${
                                    selectedVehicleId === vehicle.id ? 'bg-[#f2f5ec]' : 'bg-white'
                                  }`}
                                >
                                  <div>
                                    <p className="text-[13px] font-semibold text-[#191d17]">{vehicle.customer?.name ?? 'No customer linked'}</p>
                                    <p className="font-mono text-[12px] text-slate-600">{vehicle.code} - {vehicle.model}</p>
                                    <p className="text-[11px] text-slate-500">{vehicle.chassisNo ?? 'No chassis'} {vehicle.customer?.mobile ? `| ${vehicle.customer.mobile}` : ''}</p>
                                  </div>
                                  <span
                                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                      vehicles.some((eligible) => eligible.id === vehicle.id)
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {vehicles.some((eligible) => eligible.id === vehicle.id) ? vehicle.status : 'Not service-ready'}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-3 text-sm text-slate-500">No vehicle/customer matches that search.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">Contact Number</label>
                      <div className="flex items-center border-b border-slate-300">
                        <span className="px-2 font-mono text-sm text-slate-400">+91</span>
                        <input
                          value={contactNumber}
                          onChange={(event) => setContactNumber(event.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="Enter contact number"
                          className="w-full border-none p-2 text-[14px] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">Source of Request</label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {[
                      { key: 'Periodic' as SourceKey, icon: 'history', tone: 'text-[#1b5e20]' },
                      { key: 'Customer' as SourceKey, icon: 'person_search', tone: 'text-[#8f4e00]' },
                      { key: 'Breakdown' as SourceKey, icon: 'car_crash', tone: 'text-[#ba1a1a]' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setSource(item.key)
                          setValues((current) => ({ ...current, 'Issue Category': item.key === 'Periodic' ? 'Periodic Service' : item.key }))
                          setValues((current) => ({ ...current, Priority: item.key === 'Breakdown' ? 'High' : current.Priority }))
                        }}
                        className={`border p-4 text-left transition-all ${source === item.key ? 'border-[#1b5e20] bg-[#f2f5ec]' : 'border-slate-200 bg-white'}`}
                      >
                        <span className={`material-symbols-outlined mb-2 block ${item.tone}`}>{item.icon}</span>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#191d17]">{item.key}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 flex items-center gap-2 font-display text-[20px] font-medium text-[#191d17]">
                    <span className="flex h-6 w-6 items-center justify-center bg-slate-900 text-[10px] font-bold text-white">02</span>
                    Operational Parameters
                  </h3>
                  <div className="space-y-4">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">Complaint / Service Details</span>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        placeholder="Describe the mechanical issues or service requirements..."
                        className="w-full border-b border-slate-300 p-2 text-[14px] outline-none focus:border-[#1b5e20]"
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">Estimated Date</span>
                        <input type="date" value={estimatedDate} onChange={(event) => setEstimatedDate(event.target.value)} className="w-full border-b border-slate-300 p-2 text-[14px] outline-none focus:border-[#1b5e20]" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">Estimated Time</span>
                        <input type="time" value={estimatedTime} onChange={(event) => setEstimatedTime(event.target.value)} className="w-full border-b border-slate-300 p-2 text-[14px] outline-none focus:border-[#1b5e20]" />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(values).map(([key, value]) => (
                        <label key={key} className="block space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">{key}</span>
                          {['Issue Category', 'Priority', 'Visit Type'].includes(key) ? (
                            <select
                              value={value}
                              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                              className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]"
                            >
                              {(key === 'Issue Category'
                                ? ['Periodic Service', 'Customer', 'Breakdown', 'Warranty', 'Complaint']
                                : key === 'Priority'
                                  ? ['Low', 'Medium', 'High']
                                  : ['Workshop', 'Field']).map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          ) : key === 'Mechanic' ? (
                            <select
                              value={value}
                              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                              className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]"
                            >
                              <option value="">Select mechanic</option>
                              {technicians.map((technician) => (
                                <option key={technician.id} value={technician.name}>
                                  {technician.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={value}
                              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                              className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button onClick={saveDraft} className="border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-800 hover:bg-slate-50">
                    Save Draft
                  </button>
                  <button onClick={submit} disabled={loading || !selectedVehicle} className="bg-slate-900 px-8 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
                    {loading ? 'Saving...' : 'Proceed To Allocation'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-900 p-4 text-white">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Service Detail Context</h4>
                <p className="mt-1 font-mono text-lg">{selectedRow?.payload ? parsePayload(selectedRow.payload)['Complaint Number'] || selectedRow.ref || selectedRow.id : 'SR context pending'}</p>
              </div>
              <div className="space-y-6 p-4">
                <div className="space-y-4">
                  {[
                    { label: 'Raised', time: selectedRow?.createdAt },
                    { label: 'Allocated', time: selectedRow?.updatedAt },
                    { label: 'Completed', time: String(selectedRow?.status).toLowerCase().includes('complete') ? selectedRow?.updatedAt : '' },
                  ].map((item, index) => {
                    const active = Boolean(item.time)
                    const last = index === 2
                    return (
                      <div key={item.label} className={`flex gap-4 ${active ? '' : 'opacity-40'}`}>
                        <div className="flex flex-col items-center">
                          <div className={`h-3 w-3 rounded-full ${active ? 'bg-[#1b5e20]' : 'border-2 border-slate-300 bg-white'}`} />
                          {!last ? <div className={`w-0.5 flex-1 ${active ? 'bg-[#1b5e20]' : 'bg-slate-200'}`} /> : null}
                        </div>
                        <div className="pb-4">
                          <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${active ? 'text-[#1b5e20]' : 'text-slate-400'}`}>{item.label}</p>
                          <p className="text-[11px] text-[#717a6d]">{active ? formatMoment(item.time) : 'Pending actions'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center gap-4 border border-dashed border-slate-300 bg-[#ecefe6] p-4">
                  <div className="flex h-16 w-16 items-center justify-center bg-white text-[#1b5e20]">
                    <span className="material-symbols-outlined text-[28px]">qr_code_2</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">Job Card Access</p>
                    <button className="flex items-center gap-1 text-xs font-bold text-[#1b5e20] hover:underline">
                      <span className="material-symbols-outlined text-[14px]">share</span>
                      Generate Tablet Link
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#717a6d]">Technician Load</span>
                    <span className="bg-green-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-800">Optimal</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Staff Workload</span>
                      <span className="font-bold">72%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden bg-slate-100">
                      <div className="h-full bg-[#1b5e20]" style={{ width: '72%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative h-40 overflow-hidden">
              <img
                className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAiYOU07Lv7hAY7mXWx4UyWIVNWHIo0zYIad1-VWCXpjogPFGTtKtPmd8vxv3mJh02Aqk6iYUMQ9Jqytwe6h7KgnOBN90Lg6Jo8VL2Pk4zrcEcWGKadcrKJnfuO_jN9Re7Db_7rTtaSoYsb2qWFOEp_b0SIjZ6W7zYcnwDDXKeJoyJbSxgDVAVvHku5jIMPZ7Ts3tq7c1f3ix0mLpl3Be2w-ORLKEC_HClFHm5DM1qCA2LTOFHFkhcnCsYdjPhgxyzjPR7IKR6eTMBu"
                alt="Workshop live feed"
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-slate-900 to-transparent p-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white">Bay 04 | Live Feed</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-[#717a6d]">info</span>
          <p className="text-xs text-[#717a6d]">Draft saved 2 minutes ago. SR Number will be generated on submission.</p>
        </div>
        <div className="flex gap-3">
          <button className="border border-slate-900 px-8 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-900 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={loading || !selectedVehicle} className="bg-[#1b5e20] px-10 py-3 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg disabled:opacity-60">
            {loading ? 'Saving...' : 'Generate Service ID'}
          </button>
        </div>
      </div>
    </div>
  )
}
