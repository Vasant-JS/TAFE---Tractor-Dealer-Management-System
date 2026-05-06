import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import StatusPill from '../components/ui/StatusPill'

type PurchaseRow = {
  id: string
  ref: string
  status: string
  amount?: number | null
  due?: string
  payload?: string | null
  vehicle?: {
    id: string
    code: string
    status: string
    model: string
    engineNo: string
    chassisNo: string
  } | null
}

const initialForm = {
  'Invoice Serial Number': '',
  'Invoice Date': '',
  'E-Way Bill Number': '',
  'E-Way Bill Date': '',
  'Number of Vehicles Received': '1',
  'Total Purchase Value': '',
  'Consignment Details': '',
  'Consigner Name': '',
  'Consigner Invoice Number': '',
  'Engine Number': '',
  'Chassis Number': '',
  Model: '',
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function amountDigits(value: string) {
  return value.replace(/[^\d.]/g, '')
}

function parsePayload(payload?: string | null) {
  try {
    return payload ? JSON.parse(payload) : {}
  } catch {
    return {}
  }
}

export default function PurchaseInvoices() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('All Vendors')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Verified'>('All')
  const [formValues, setFormValues] = useState(initialForm)
  const [selectedPreviewId, setSelectedPreviewId] = useState('')

  const loadRows = async () => {
    const { data } = await api.get('/modules/purchase/work-items')
    setRows(data)
  }

  useEffect(() => {
    loadRows().catch(() => toast.error('Could not load purchase invoices'))
  }, [])

  const vendorOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        rows
          .map((row) => String(parsePayload(row.payload)['Consigner Name'] ?? '').trim())
          .filter(Boolean),
      ),
    )
    return ['All Vendors', ...names]
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const payload = parsePayload(row.payload)
      const invoiceNo = String(payload['Invoice Serial Number'] ?? '')
      const invoiceDate = String(payload['Invoice Date'] ?? '')
      const vendorName = String(payload['Consigner Name'] ?? '').trim()
      const uiStatus = row.status === 'Complete' ? 'Verified' : row.status === 'Pending' ? 'Pending' : row.status
      const matchesQuery = !query.trim() || invoiceNo.toLowerCase().includes(query.trim().toLowerCase())
      const matchesDate = !dateFilter || invoiceDate === dateFilter
      const matchesVendor = vendorFilter === 'All Vendors' || vendorName === vendorFilter
      const matchesStatus = statusFilter === 'All' || uiStatus === statusFilter
      return matchesQuery && matchesDate && matchesVendor && matchesStatus
    })
  }, [rows, query, dateFilter, vendorFilter, statusFilter])

  const updateField = (field: keyof typeof initialForm, value: string) => {
    let nextValue = value
    if (field === 'Number of Vehicles Received') nextValue = onlyDigits(value)
    if (field === 'Total Purchase Value') nextValue = amountDigits(value)
    setFormValues((current) => ({ ...current, [field]: nextValue }))
  }

  const clearForm = () => setFormValues(initialForm)

  const exportCsv = () => {
    if (!filteredRows.length) {
      toast.error('No purchase invoice rows available to export')
      return
    }
    const headers = ['Invoice Serial Number', 'Invoice Date', 'E-Way Bill Number', 'Vehicles', 'Total Purchase Value', 'Consigner Name', 'Workflow Status']
    const lines = filteredRows.map((row) => {
      const payload = parsePayload(row.payload)
      return [
        payload['Invoice Serial Number'] ?? row.ref,
        payload['Invoice Date'] ?? '',
        payload['E-Way Bill Number'] ?? '',
        payload['Number of Vehicles Received'] ?? '',
        row.amount ?? '',
        payload['Consigner Name'] ?? '',
        row.status === 'Complete' ? 'Verified' : row.status,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    })
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'purchase-invoices.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Purchase invoice CSV exported')
  }

  const openAddInvoice = () => {
    clearForm()
    setSelectedPreviewId('')
    document.getElementById('purchase-entry-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const submitInvoice = async () => {
    if (!formValues['Invoice Serial Number'] || !formValues['Invoice Date'] || !formValues['E-Way Bill Number'] || !formValues['E-Way Bill Date']) {
      toast.error('Fill the required invoice fields first')
      return
    }
    if (!formValues['Number of Vehicles Received'] || Number(formValues['Number of Vehicles Received']) < 1) {
      toast.error('Vehicle count must be at least 1')
      return
    }
    setLoading(true)
    try {
      await api.post('/modules/purchase/work-items', formValues)
      clearForm()
      await loadRows()
      toast.success('Purchase invoice created')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not create purchase invoice')
    } finally {
      setLoading(false)
    }
  }

  const rowTone = (status: string) => {
    if (status === 'Complete') return 'success' as const
    if (status === 'Pending') return 'warning' as const
    if (status === 'Error') return 'danger' as const
    return 'info' as const
  }

  const selectedPreview = useMemo(() => rows.find((row) => row.id === selectedPreviewId) ?? null, [rows, selectedPreviewId])

  const openPreview = (row: PurchaseRow) => {
    setSelectedPreviewId(row.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openVehicleAction = (row: PurchaseRow) => {
    if (!row.vehicle?.id) {
      toast.error('No vehicle record is linked to this invoice yet')
      return
    }
    navigate(`/pdi?vehicleId=${row.vehicle.id}`)
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-28">
      <div className="px-6 py-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-[32px] font-bold text-[#00450d]">Purchase Invoices</h1>
            <div className="mt-1 flex gap-2 text-[12px] font-bold uppercase tracking-wider text-[#717a6d]">
              <span>Inventory</span>
              <span>/</span>
              <span className="text-[#1b5e20]">Purchase Invoices</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 rounded border border-[#717a6d] bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-[#00450d]">
              <span className="material-symbols-outlined text-sm">download</span>
              Export CSV
            </button>
            <button onClick={openAddInvoice} className="flex items-center gap-2 rounded bg-[#1b5e20] px-6 py-2 text-[12px] font-bold uppercase tracking-wider text-white">
              <span className="material-symbols-outlined text-sm">add</span>
              Add Invoice
            </button>
          </div>
        </div>

        <div className="mb-4 rounded border border-slate-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Search Records</span>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">filter_list</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded border border-slate-200 p-2 pl-8 text-sm" placeholder="By Invoice No..." />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Range</span>
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="w-full rounded border border-slate-200 p-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vendor Status</span>
              <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} className="w-full rounded border border-slate-200 p-2 text-sm">
                {vendorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
              <div className="flex gap-2">
                {(['All', 'Pending', 'Verified'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatusFilter(option)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${statusFilter === option ? 'bg-[#1b5e20] text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#1b5e20] text-[11px] uppercase tracking-widest text-white">
                <th className="border-r border-[#00450d]/20 p-4">Invoice No</th>
                <th className="border-r border-[#00450d]/20 p-4">Invoice Date</th>
                <th className="border-r border-[#00450d]/20 p-4">E-Way Bill No</th>
                <th className="border-r border-[#00450d]/20 p-4 text-center">Vehicles</th>
                <th className="border-r border-[#00450d]/20 p-4 text-right">Total Value (Rs)</th>
                <th className="border-r border-[#00450d]/20 p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const payload = parsePayload(row.payload)
                return (
                  <tr key={row.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="p-4 font-mono text-[13px] font-bold text-[#1b5e20]">{payload['Invoice Serial Number'] || row.ref}</td>
                    <td className="p-4 text-sm">{payload['Invoice Date'] || '-'}</td>
                    <td className="p-4 font-mono text-sm">{payload['E-Way Bill Number'] || '-'}</td>
                    <td className="p-4 text-center font-bold">{payload['Number of Vehicles Received'] || '-'}</td>
                    <td className="p-4 text-right font-mono font-bold">{row.amount ? `Rs ${row.amount.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="p-4"><StatusPill tone={rowTone(row.status)}>{row.status === 'Complete' ? 'Verified' : row.status}</StatusPill></td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openPreview(row)} className="rounded-full p-2 text-[#1b5e20] hover:bg-[#1b5e20]/10">
                          <span className="material-symbols-outlined text-xl">visibility</span>
                        </button>
                        <button onClick={() => openVehicleAction(row)} className="rounded-full p-2 text-[#8f4e00] hover:bg-[#8f4e00]/10">
                          <span className="material-symbols-outlined text-xl">agriculture</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!filteredRows.length ? <div className="p-5 text-sm text-slate-500">No purchase invoice rows yet.</div> : null}
        </div>

        {selectedPreview ? (
          <section className="mt-6 rounded border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice Preview</p>
                <h2 className="mt-2 text-lg font-semibold text-[#00450d]">{parsePayload(selectedPreview.payload)['Invoice Serial Number'] || selectedPreview.ref}</h2>
              </div>
              <button onClick={() => setSelectedPreviewId('')} className="rounded border border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {Object.entries(parsePayload(selectedPreview.payload)).map(([key, value]) => (
                <div key={key} className="rounded border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{key}</p>
                  <p className="mt-2 text-sm text-slate-900">{String(value)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div id="purchase-entry-section" className="mt-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-1 w-8 bg-[#1b5e20]" />
            <h2 className="font-display text-[24px] font-semibold uppercase text-[#00450d]">New Purchase Entry</h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="relative overflow-hidden rounded border border-slate-200 bg-white p-6">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1b5e20]" />
              <div className="mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1b5e20]">description</span>
                <h3 className="font-display text-[20px] font-semibold text-[#191d17]">Invoice Details</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice Serial No</span>
                  <input value={formValues['Invoice Serial Number']} onChange={(event) => updateField('Invoice Serial Number', event.target.value)} className="w-full border-b border-slate-300 p-2 text-sm font-mono focus:border-[#1b5e20] focus:outline-none" placeholder="e.g. TAFE-2023-001" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice Date</span>
                  <input type="date" value={formValues['Invoice Date']} onChange={(event) => updateField('Invoice Date', event.target.value)} className="w-full border-b border-slate-300 p-2 text-sm focus:border-[#1b5e20] focus:outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-Way Bill No</span>
                  <input value={formValues['E-Way Bill Number']} onChange={(event) => updateField('E-Way Bill Number', event.target.value)} className="w-full border-b border-slate-300 p-2 text-sm font-mono focus:border-[#1b5e20] focus:outline-none" placeholder="12 Digit E-Way No" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bill Date</span>
                  <input type="date" value={formValues['E-Way Bill Date']} onChange={(event) => updateField('E-Way Bill Date', event.target.value)} className="w-full border-b border-slate-300 p-2 text-sm focus:border-[#1b5e20] focus:outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vehicle Count</span>
                  <div className="flex items-center border-b border-slate-300">
                    <button type="button" onClick={() => updateField('Number of Vehicles Received', String(Math.max(1, Number(formValues['Number of Vehicles Received'] || '1') - 1)))} className="p-2 text-[#00450d] hover:bg-slate-50">
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <input value={formValues['Number of Vehicles Received']} onChange={(event) => updateField('Number of Vehicles Received', event.target.value)} className="w-full border-none text-center text-sm font-bold focus:outline-none" />
                    <button type="button" onClick={() => updateField('Number of Vehicles Received', String(Number(formValues['Number of Vehicles Received'] || '0') + 1))} className="p-2 text-[#00450d] hover:bg-slate-50">
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Invoice Value</span>
                  <div className="flex items-center border-b border-slate-300">
                    <span className="px-2 font-mono text-slate-400">Rs</span>
                    <input value={formValues['Total Purchase Value']} onChange={(event) => updateField('Total Purchase Value', event.target.value)} className="w-full border-none p-2 text-right text-sm font-mono font-bold focus:outline-none" placeholder="0.00" />
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Engine Number</span>
                  <input value={formValues['Engine Number']} onChange={(event) => updateField('Engine Number', event.target.value)} className="w-full border-b border-slate-300 p-2 text-sm font-mono focus:border-[#1b5e20] focus:outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chassis Number</span>
                  <input value={formValues['Chassis Number']} onChange={(event) => updateField('Chassis Number', event.target.value)} className="w-full border-b border-slate-300 p-2 text-sm font-mono focus:border-[#1b5e20] focus:outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Model</span>
                  <input value={formValues.Model} onChange={(event) => updateField('Model', event.target.value)} className="w-full border-b border-slate-300 p-2 text-sm focus:border-[#1b5e20] focus:outline-none" />
                </label>
              </div>
            </section>

            <section className="relative overflow-hidden rounded border border-slate-200 bg-white p-6">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1b5e20]" />
              <div className="mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1b5e20]">local_shipping</span>
                <h3 className="font-display text-[20px] font-semibold text-[#191d17]">Logistics Receipt</h3>
              </div>
              <div className="space-y-4">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Consignment Note / LR Detail</span>
                  <textarea value={formValues['Consignment Details']} onChange={(event) => updateField('Consignment Details', event.target.value)} className="w-full rounded border border-slate-200 p-3 text-sm focus:border-[#1b5e20] focus:outline-none" placeholder="Enter full consignment descriptions as per LR copy..." rows={4} />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Consigner Name</span>
                  <input value={formValues['Consigner Name']} onChange={(event) => updateField('Consigner Name', event.target.value)} className="w-full rounded border border-slate-200 p-3 text-sm focus:border-[#1b5e20] focus:outline-none" placeholder="TAFE Manufacturing Unit - Chennai" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Consigner Invoice Number</span>
                  <input value={formValues['Consigner Invoice Number']} onChange={(event) => updateField('Consigner Invoice Number', event.target.value)} className="w-full rounded border border-slate-200 p-3 text-sm font-mono focus:border-[#1b5e20] focus:outline-none" placeholder="Vendor reference number" />
                </label>
              </div>
            </section>
          </div>

          <div className="mt-4 flex items-center gap-4 rounded border border-[#00450d]/20 bg-[#acf4a4] p-4 text-sm text-[#002203]">
            <span className="material-symbols-outlined text-[#1b5e20] material-symbols-filled">info</span>
            <p>
              <span className="font-bold">Automated Workflow:</span> Submitting this invoice will auto-generate{' '}
              <span className="font-mono font-bold">{formValues['Number of Vehicles Received'] || '0'}</span> vehicle record(s) for Pre-Delivery Inspection (PDI) tracking in the inventory module.
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          Draft mode active
        </div>
        <div className="flex gap-4">
          <button onClick={clearForm} className="rounded border border-slate-300 px-6 py-3 text-[12px] font-bold uppercase tracking-wider text-slate-700">
            Cancel Entry
          </button>
          <button onClick={submitInvoice} disabled={loading} className="rounded border border-[#1b5e20] px-6 py-3 text-[12px] font-bold uppercase tracking-wider text-[#1b5e20] disabled:opacity-60">
            Save Draft
          </button>
          <button onClick={submitInvoice} disabled={loading} className="rounded bg-[#1b5e20] px-8 py-3 text-[12px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
            {loading ? 'Submitting...' : 'Submit Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
