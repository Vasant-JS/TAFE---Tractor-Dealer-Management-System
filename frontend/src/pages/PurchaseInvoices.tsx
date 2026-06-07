import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
  documents?: Array<{ id: string; name: string; fileName?: string | null }>
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
  IRN: '',
  'Ack Number': '',
  'Ack Date': '',
  'Invoice Serial Number': '',
  'Invoice Date': '',
  'CIN Number': '',
  PAN: '',
  'PO Number': '',
  'RTGS Date': '',
  'E-Way Bill Number': '',
  'E-Way Bill Date': '',
  'Consigner GST Number': '',
  'Consigner Name': '',
  'Consigner Address': '',
  'Receiver Name': '',
  'Receiver Address': '',
  'Receiver State': '',
  'Receiver GSTIN': '',
  'Place of Supply': '',
  'Consignor Name': '',
  'Consignor Address': '',
  'Consignor State': '',
  'Consignor GSTIN': '',
  'Consignor PAN': '',
  'Number of Vehicles Received': '1',
  'Total Purchase Value': '',
  'Engine Number': '',
  'Chassis Number': '',
  Model: '',
  'LR Copy File Name': '',
  'LR GC Number': '',
  'LR Date': '',
  'LR Destination': '',
  'LR Truck Number': '',
  'LR Transporter Name': '',
  'LR Transporter Address': '',
  'LR Consignor': '',
  'LR Consignee': '',
  'LR Model Number': '',
  'LR Tractor Serial Number': '',
  'LR Invoice Number': '',
  'LR Invoice Date': '',
  'LR Invoice Value': '',
  'LR Freight': '',
  'LR Remarks': '',
  'Consignment Details': '',
}

const invoiceFields = [
  { key: 'IRN', label: 'IRN', placeholder: 'Invoice Reference Number' },
  { key: 'Ack Number', label: 'Ack. No.', placeholder: 'Acknowledgement number' },
  { key: 'Ack Date', label: 'Ack. Date', type: 'date' },
  { key: 'Invoice Serial Number', label: 'Serial No. of Invoice', placeholder: 'e.g. TAFE-2026-001' },
  { key: 'Invoice Date', label: 'Date of Invoice', type: 'date' },
  { key: 'E-Way Bill Number', label: 'E-Way Bill No.', placeholder: 'E-way bill number' },
  { key: 'E-Way Bill Date', label: 'E-Way Bill Date', type: 'date' },
  { key: 'Consigner GST Number', label: 'Consigner GST No.', placeholder: 'GSTIN' },
  { key: 'Consigner Name', label: 'Consigner Name', placeholder: 'Supplier/legal name' },
  { key: 'Consigner Address', label: 'Consigner Address', placeholder: 'Registered address' },
  { key: 'CIN Number', label: 'CIN No.', placeholder: 'Corporate identity number' },
  { key: 'PAN', label: 'PAN', placeholder: 'PAN' },
  { key: 'PO Number', label: 'PO No.', placeholder: 'Purchase order number' },
  { key: 'RTGS Date', label: 'RTGS/Date', type: 'date' },
] as const

const receiverFields = [
  { key: 'Receiver Name', label: 'Name' },
  { key: 'Receiver Address', label: 'Address' },
  { key: 'Receiver State', label: 'State' },
  { key: 'Receiver GSTIN', label: 'GSTIN' },
  { key: 'Place of Supply', label: 'Place of Supply' },
] as const

const consignorFields = [
  { key: 'Consignor Name', label: 'Name' },
  { key: 'Consignor Address', label: 'Address' },
  { key: 'Consignor State', label: 'State' },
  { key: 'Consignor GSTIN', label: 'GSTIN' },
  { key: 'Consignor PAN', label: 'PAN' },
] as const

const lrFields = [
  { key: 'LR GC Number', label: 'G.C. / LR No.', placeholder: 'e.g. 2311' },
  { key: 'LR Date', label: 'LR Date', type: 'date' },
  { key: 'LR Destination', label: 'Destination' },
  { key: 'LR Truck Number', label: 'Truck No.' },
  { key: 'LR Transporter Name', label: 'Transporter Name', placeholder: 'e.g. Esteem Trucking Pvt Ltd' },
  { key: 'LR Transporter Address', label: 'Transporter Address' },
  { key: 'LR Consignor', label: 'LR Consignor' },
  { key: 'LR Consignee', label: 'LR Consignee' },
  { key: 'LR Model Number', label: 'Model No.' },
  { key: 'LR Tractor Serial Number', label: 'Tractor Sl. No.' },
  { key: 'LR Invoice Number', label: 'Invoice No.' },
  { key: 'LR Invoice Date', label: 'Invoice Date', type: 'date' },
  { key: 'LR Invoice Value', label: 'Invoice Value' },
  { key: 'LR Freight', label: 'Freight' },
] as const

type SectionId = 'invoice' | 'receiver' | 'consignor' | 'vehicle' | 'lr'
type FieldConfig = { key: keyof typeof initialForm; label: string; type?: string; placeholder?: string }

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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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
  const [lrCopyFile, setLrCopyFile] = useState<File | null>(null)
  const [selectedPreviewId, setSelectedPreviewId] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>({
    invoice: false,
    receiver: false,
    consignor: false,
    vehicle: false,
    lr: false,
  })

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
    if (field === 'Total Purchase Value' || field === 'LR Invoice Value' || field === 'LR Freight') nextValue = amountDigits(value)
    setFormValues((current) => ({ ...current, [field]: nextValue }))
  }

  const clearForm = () => {
    setFormValues(initialForm)
    setLrCopyFile(null)
  }

  const exportCsv = () => {
    if (!filteredRows.length) {
      toast.error('No purchase invoice rows available to export')
      return
    }
    const headers = ['IRN', 'Ack Number', 'Ack Date', 'Invoice Serial Number', 'Invoice Date', 'E-Way Bill Number', 'Receiver Name', 'Receiver GSTIN', 'Consigner Name', 'Consigner GST Number', 'LR GC Number', 'LR Truck Number', 'Vehicles', 'Total Purchase Value', 'Workflow Status']
    const lines = filteredRows.map((row) => {
      const payload = parsePayload(row.payload)
      return [
        payload.IRN ?? '',
        payload['Ack Number'] ?? '',
        payload['Ack Date'] ?? '',
        payload['Invoice Serial Number'] ?? row.ref,
        payload['Invoice Date'] ?? '',
        payload['E-Way Bill Number'] ?? '',
        payload['Receiver Name'] ?? '',
        payload['Receiver GSTIN'] ?? '',
        payload['Consigner Name'] ?? '',
        payload['Consigner GST Number'] ?? '',
        payload['LR GC Number'] ?? '',
        payload['LR Truck Number'] ?? '',
        payload['Number of Vehicles Received'] ?? '',
        row.amount ?? '',
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
    const requiredFields: Array<keyof typeof initialForm> = [
      'IRN',
      'Ack Number',
      'Ack Date',
      'Invoice Serial Number',
      'Invoice Date',
      'E-Way Bill Number',
      'E-Way Bill Date',
      'Consigner GST Number',
      'Consigner Name',
      'Consigner Address',
      'CIN Number',
      'PAN',
      'Receiver Name',
      'Receiver Address',
      'Receiver State',
      'Receiver GSTIN',
      'Place of Supply',
      'Consignor Name',
      'Consignor Address',
      'Consignor State',
      'Consignor GSTIN',
      'Consignor PAN',
      'Engine Number',
      'Chassis Number',
      'Model',
    ]
    if (requiredFields.some((field) => !formValues[field])) {
      toast.error('Fill all mandatory invoice, receiver, consigner, and tractor fields first')
      return
    }
    if (!formValues['Number of Vehicles Received'] || Number(formValues['Number of Vehicles Received']) < 1) {
      toast.error('Vehicle count must be at least 1')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/modules/purchase/work-items', formValues)
      const lrDocument = data.documents?.find((document: { name: string }) => document.name.toLowerCase().includes('lr copy') || document.name.toLowerCase().includes('lr receipt'))
      if (lrCopyFile && lrDocument?.id) {
        await api.patch(`/documents/${lrDocument.id}/upload`, {
          fileName: lrCopyFile.name,
          contentBase64: await fileToBase64(lrCopyFile),
          mimeType: lrCopyFile.type,
        })
      }
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

  const toggleSection = (section: SectionId) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }))
  }

  const completedCount = (fields: readonly FieldConfig[]) => fields.filter((field) => Boolean(formValues[field.key])).length

  const renderInput = (field: FieldConfig) => (
    <label key={field.key} className="space-y-1">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{field.label}</span>
      <input
        type={field.type ?? 'text'}
        value={formValues[field.key]}
        onChange={(event) => updateField(field.key, event.target.value)}
        className="w-full border-b border-slate-300 px-1.5 py-1.5 text-sm focus:border-[#1b5e20] focus:outline-none"
        placeholder={field.placeholder}
      />
    </label>
  )

  const renderSection = (
    section: SectionId,
    title: string,
    icon: string,
    fields: readonly FieldConfig[],
    children: ReactNode,
    className = '',
  ) => {
    const complete = completedCount(fields)
    const total = fields.length
    return (
      <section className={`relative overflow-hidden rounded border border-slate-200 bg-white ${className}`}>
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1b5e20]" />
        <button
          type="button"
          onClick={() => toggleSection(section)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[#1b5e20]">{icon}</span>
            <span className="truncate font-display text-[17px] font-semibold text-[#191d17]">{title}</span>
          </span>
          <span className="flex items-center gap-3">
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${complete === total ? 'bg-[#1b5e20] text-white' : 'bg-slate-100 text-slate-600'}`}>
              {complete}/{total}
            </span>
            <span className="material-symbols-outlined text-slate-500">{collapsedSections[section] ? 'expand_more' : 'expand_less'}</span>
          </span>
        </button>
        {!collapsedSections[section] ? <div className="px-4 pb-4">{children}</div> : null}
      </section>
    )
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

          <div className="grid gap-3 xl:grid-cols-2">
            {renderSection(
              'invoice',
              'Invoice & E-Invoice Details',
              'description',
              [...invoiceFields, { key: 'Number of Vehicles Received', label: 'Vehicle Count' }, { key: 'Total Purchase Value', label: 'Total Invoice Value' }],
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                {invoiceFields.map(renderInput)}
                <label className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Vehicle Count</span>
                  <div className="flex items-center border-b border-slate-300">
                    <button type="button" onClick={() => updateField('Number of Vehicles Received', String(Math.max(1, Number(formValues['Number of Vehicles Received'] || '1') - 1)))} className="p-1.5 text-[#00450d] hover:bg-slate-50">
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <input value={formValues['Number of Vehicles Received']} onChange={(event) => updateField('Number of Vehicles Received', event.target.value)} className="w-full border-none text-center text-sm font-bold focus:outline-none" />
                    <button type="button" onClick={() => updateField('Number of Vehicles Received', String(Number(formValues['Number of Vehicles Received'] || '0') + 1))} className="p-1.5 text-[#00450d] hover:bg-slate-50">
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total Invoice Value</span>
                  <div className="flex items-center border-b border-slate-300">
                    <span className="px-2 font-mono text-slate-400">Rs</span>
                    <input value={formValues['Total Purchase Value']} onChange={(event) => updateField('Total Purchase Value', event.target.value)} className="w-full border-none px-1.5 py-1.5 text-right text-sm font-mono font-bold focus:outline-none" placeholder="0.00" />
                  </div>
                </label>
              </div>,
              'xl:col-span-2',
            )}

            {renderSection(
              'receiver',
              'Receiver Details (Billed To)',
              'storefront',
              receiverFields,
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {receiverFields.map(renderInput)}
              </div>,
            )}

            {renderSection(
              'consignor',
              'Consigner Details',
              'factory',
              consignorFields,
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {consignorFields.map(renderInput)}
              </div>,
            )}

            {renderSection(
              'vehicle',
              'Vehicle Details',
              'agriculture',
              [
                { key: 'Model', label: 'Model' },
                { key: 'Engine Number', label: 'Engine Number' },
                { key: 'Chassis Number', label: 'Chassis Number' },
              ],
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {renderInput({ key: 'Model', label: 'Model' })}
                {renderInput({ key: 'Engine Number', label: 'Engine Number' })}
                {renderInput({ key: 'Chassis Number', label: 'Chassis Number' })}
              </div>,
            )}

            {renderSection(
              'lr',
              'LR Copy & Logistics Receipt',
              'local_shipping',
              [...lrFields, { key: 'LR Copy File Name', label: 'Attach LR Copy' }, { key: 'Consignment Details', label: 'Consignment Details / Remarks' }],
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                <label className="space-y-1 sm:col-span-2 lg:col-span-4 2xl:col-span-5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Attach LR Copy</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setLrCopyFile(file)
                      updateField('LR Copy File Name', file?.name ?? '')
                    }}
                    className="w-full rounded border border-dashed border-slate-300 bg-slate-50 p-2 text-sm"
                  />
                  {formValues['LR Copy File Name'] ? <p className="text-xs text-slate-500">Selected: {formValues['LR Copy File Name']}</p> : null}
                </label>
                {lrFields.map(renderInput)}
                <label className="space-y-1 sm:col-span-2 lg:col-span-4 2xl:col-span-5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Consignment Details / Remarks</span>
                  <textarea
                    value={formValues['Consignment Details']}
                    onChange={(event) => updateField('Consignment Details', event.target.value)}
                    className="w-full rounded border border-slate-200 p-2 text-sm focus:border-[#1b5e20] focus:outline-none"
                    placeholder="Enter full LR remarks, delivery notes, or multi-tractor line details from the LR copy."
                    rows={2}
                  />
                </label>
              </div>,
              'xl:col-span-2',
            )}
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
