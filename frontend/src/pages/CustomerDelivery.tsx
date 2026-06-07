import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { fileToUploadPayload } from '../lib/upload'

type Vehicle = {
  id: string
  code: string
  engineNo: string
  chassisNo: string
  model: string
  status: string
  customer?: {
    id: string
    name: string
    mobile: string
    address: string
  } | null
}

type WorkItem = {
  id: string
  vehicleId?: string | null
  payload?: string | null
  status?: string
  documents: { id: string; name: string; status: string; fileName?: string | null }[]
}

type GatePassDraft = {
  jobCardNo: string
  date: string
  time: string
  toName: string
  permissionText: string
  item: string
  quantity: string
}

const initialGatePass: GatePassDraft = {
  jobCardNo: '',
  date: '',
  time: '',
  toName: '',
  permissionText: '',
  item: '',
  quantity: '',
}

const customerHistoryFields = [
  'Customer Name',
  'Customer Address',
  'Mobile Number',
  'Aadhaar Number',
  'PAN Number',
  'Reference / Key Person',
  'Selling Dealer Name and Stamp',
  'Office / SM / DSP Name',
  'Tractor Serial Number',
  'Model',
  'Date of Installation',
  'Chassis Number',
  'Engine Number',
  'Battery Make',
  'Battery SN',
  'FIP Number',
  'OIB Number',
  'Tyre Make',
  'Front Tyre LH',
  'Front Tyre RH',
  'Front Tyre Make',
  'Rear Tyre LH',
  'Rear Tyre RH',
  'Rear Tyre Make',
]

const salesDocuments = [
  { section: 'Customer Agreement', name: 'Customer Agreement', formats: 'PDF, JPG, PNG', note: 'Signed customer agreement copy' },
  { section: 'Voucher & Sheets', name: 'Voucher', formats: 'PDF, JPG, PNG', note: 'Payment or delivery voucher' },
  { section: 'Voucher & Sheets', name: 'Customer History Sheet', formats: 'PDF, JPG, PNG', note: 'Customer history sheet copy' },
  { section: 'Customer Details', name: 'Aadhaar Card', formats: 'PDF, JPG, PNG', note: 'Customer Aadhaar proof' },
  { section: 'Customer Details', name: 'PAN Card', formats: 'PDF, JPG, PNG', note: 'Customer PAN proof' },
  { section: 'Customer Details', name: 'Customer Details Form', formats: 'PDF, JPG, PNG', note: 'Full customer detail sheet' },
  { section: 'Gatepass, Invoice & Quotation', name: 'Delivery Challan', formats: 'PDF, JPG, PNG', note: 'Signed delivery challan' },
  { section: 'Gatepass, Invoice & Quotation', name: 'Gate Pass', formats: 'PDF, JPG, PNG', note: 'Generated or uploaded gate pass' },
  { section: 'Gatepass, Invoice & Quotation', name: 'Tractor Invoice', formats: 'PDF', note: 'Final tractor invoice' },
  { section: 'Gatepass, Invoice & Quotation', name: 'Quotation', formats: 'PDF', note: 'Sales quotation' },
  { section: 'Delivery Media', name: 'Delivery Photo', formats: 'JPG, PNG', note: 'Photo taken during delivery' },
  { section: 'Delivery Media', name: 'Video Byte', formats: 'MP4, MOV', note: 'Customer delivery video byte' },
] as const

const docSections = ['Customer Agreement', 'Voucher & Sheets', 'Customer Details', 'Gatepass, Invoice & Quotation', 'Delivery Media']
const requiredHistoryFields = ['Customer Name', 'Customer Address', 'Mobile Number', 'Aadhaar Number', 'PAN Number', 'Model', 'Tractor Serial Number', 'Engine Number']
const requiredGatePassFields: Array<keyof GatePassDraft> = ['jobCardNo', 'date', 'time', 'toName', 'permissionText', 'item', 'quantity']

function parsePayload(payload?: string | null) {
  try {
    return payload ? JSON.parse(payload) : {}
  } catch {
    return {}
  }
}

function fieldKey(label: string) {
  return label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}

function compactDigits(value: string) {
  return value.replace(/\D/g, '')
}

export default function CustomerDelivery() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [historyValues, setHistoryValues] = useState<Record<string, string>>({})
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [gatePassOpen, setGatePassOpen] = useState(false)
  const [gatePass, setGatePass] = useState<GatePassDraft>(initialGatePass)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [gatePassErrors, setGatePassErrors] = useState<Partial<Record<keyof GatePassDraft, string>>>({})
  const [loading, setLoading] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [loadIssue, setLoadIssue] = useState('')

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const workItem = useMemo(() => workItems.find((item) => item.vehicleId === selectedVehicleId) ?? null, [selectedVehicleId, workItems])
  const workPayload = useMemo(() => parsePayload(workItem?.payload), [workItem])
  const isFinalized = Boolean(workPayload['Sales History Finalized'] || workPayload['Delivery Finalized'])

  const load = async () => {
    const [vehicleRes, workItemRes] = await Promise.allSettled([api.get('/vehicles'), api.get('/modules/delivery/work-items')])
    const vehicleRows = vehicleRes.status === 'fulfilled' ? vehicleRes.value.data : []
    const workItemRows = workItemRes.status === 'fulfilled' ? workItemRes.value.data : []
    const filtered = vehicleRows.filter((vehicle: Vehicle) =>
      ['Allocated to Customer', 'Delivered', 'Safety Completed', 'Insured', 'RTO Verification In Progress', 'RTO Filed', 'Financially Closed', 'Closed'].includes(vehicle.status),
    )
    setVehicles(filtered)
    setWorkItems(workItemRows)
    if (requestedVehicleId && filtered.some((vehicle: Vehicle) => vehicle.id === requestedVehicleId)) {
      setSelectedVehicleId(requestedVehicleId)
    } else if (!selectedVehicleId && filtered[0]?.id) {
      setSelectedVehicleId(filtered[0].id)
    }
    if (vehicleRes.status === 'rejected' && workItemRes.status === 'rejected') {
      setLoadIssue('Sales history data is temporarily unavailable. Refresh once the backend is up.')
    } else if (!filtered.length) {
      setLoadIssue('No vehicle is ready for Sales History yet. Complete Installation Certificate first.')
    } else {
      setLoadIssue('')
    }
    setPageReady(true)
  }

  useEffect(() => {
    load().catch(() => {
      setLoadIssue('Sales history data is temporarily unavailable. Refresh once the backend is up.')
      setPageReady(true)
    })
  }, [requestedVehicleId])

  useEffect(() => {
    const payload = parsePayload(workItem?.payload)
    setHistoryValues({
      ...Object.fromEntries(customerHistoryFields.map((field) => [field, String(payload[field] ?? '')])),
      'Customer Name': String(payload['Customer Name'] ?? selectedVehicle?.customer?.name ?? ''),
      'Customer Address': String(payload['Customer Address'] ?? selectedVehicle?.customer?.address ?? ''),
      'Mobile Number': String(payload['Mobile Number'] ?? selectedVehicle?.customer?.mobile ?? ''),
      'Model': String(payload.Model ?? selectedVehicle?.model ?? ''),
      'Chassis Number': String(payload['Chassis Number'] ?? selectedVehicle?.chassisNo ?? ''),
      'Tractor Serial Number': String(payload['Tractor Serial Number'] ?? payload['Chassis Number'] ?? selectedVehicle?.chassisNo ?? ''),
      'Engine Number': String(payload['Engine Number'] ?? selectedVehicle?.engineNo ?? ''),
    })
    setAgreementAccepted(Boolean(payload['Customer Agreement Accepted']))
    setGatePass({
      jobCardNo: String(payload['Gate Pass Job Card No'] ?? ''),
      date: String(payload['Gate Pass Date'] ?? ''),
      time: String(payload['Gate Pass Time'] ?? ''),
      toName: String(payload['Gate Pass To'] ?? selectedVehicle?.customer?.name ?? ''),
      permissionText: String(payload['Gate Pass Permission'] ?? 'is permitted to take out of the workshop / premises'),
      item: String(payload['Gate Pass Item'] ?? selectedVehicle?.model ?? ''),
      quantity: String(payload['Gate Pass Quantity'] ?? '1'),
    })
  }, [selectedVehicle, workItem])

  const visibleDocuments = useMemo(() => {
    return salesDocuments.map((doc) => {
      const liveDoc = workItem?.documents?.find((item) => item.name === doc.name)
      return { ...doc, id: liveDoc?.id ?? '', fileName: liveDoc?.fileName ?? null, active: Boolean(liveDoc) }
    })
  }, [workItem])

  const uploadedDocCount = visibleDocuments.filter((document) => document.fileName).length
  const gatePassGenerated = Boolean(workPayload['Gate Pass Generated'])

  const validateSalesHistory = (finalize = false) => {
    const nextErrors: Record<string, string> = {}
    requiredHistoryFields.forEach((field) => {
      if (!String(historyValues[field] ?? '').trim()) nextErrors[field] = 'Required'
    })
    const mobile = compactDigits(historyValues['Mobile Number'] ?? '')
    if (mobile && mobile.length !== 10) nextErrors['Mobile Number'] = 'Enter 10 digits'
    const aadhaar = compactDigits(historyValues['Aadhaar Number'] ?? '')
    if (aadhaar && aadhaar.length !== 12) nextErrors['Aadhaar Number'] = 'Enter 12 digits'
    const pan = String(historyValues['PAN Number'] ?? '').trim().toUpperCase()
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) nextErrors['PAN Number'] = 'Use PAN format ABCDE1234F'
    if (finalize && !agreementAccepted) nextErrors['Customer Agreement Accepted'] = 'Accept agreement'
    if (finalize && !gatePassGenerated) nextErrors['Gate Pass'] = 'Generate gate pass before finalizing'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast.error('Please fix highlighted Sales History fields')
      return false
    }
    return true
  }

  const validateGatePass = () => {
    const nextErrors: Partial<Record<keyof GatePassDraft, string>> = {}
    requiredGatePassFields.forEach((field) => {
      if (!String(gatePass[field] ?? '').trim()) nextErrors[field] = 'Required'
    })
    if (gatePass.quantity && (!/^\d+$/.test(gatePass.quantity) || Number(gatePass.quantity) < 1)) {
      nextErrors.quantity = 'Use a valid quantity'
    }
    setGatePassErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast.error('Please fix highlighted Gate Pass fields')
      return false
    }
    return true
  }

  const saveSalesHistory = async (finalize = false) => {
    if (!selectedVehicle) {
      toast.error('Select a vehicle first')
      return
    }
    if (!validateSalesHistory(finalize)) return
    setLoading(true)
    try {
      const payload: Record<string, string | boolean> = {
        ...historyValues,
        'Vehicle Code': selectedVehicle.code,
        'Customer Name': historyValues['Customer Name'] || selectedVehicle.customer?.name || '',
        'Customer Address': historyValues['Customer Address'] || selectedVehicle.customer?.address || '',
        'Mobile Number': historyValues['Mobile Number'] || selectedVehicle.customer?.mobile || '',
        'Model': historyValues.Model || selectedVehicle.model,
        'Chassis Number': historyValues['Tractor Serial Number'] || historyValues['Chassis Number'] || selectedVehicle.chassisNo,
        'Tractor Serial Number': historyValues['Tractor Serial Number'] || historyValues['Chassis Number'] || selectedVehicle.chassisNo,
        'Engine Number': historyValues['Engine Number'] || selectedVehicle.engineNo,
        'Customer Agreement Accepted': agreementAccepted,
        'Gate Pass Job Card No': gatePass.jobCardNo,
        'Gate Pass Date': gatePass.date,
        'Gate Pass Time': gatePass.time,
        'Gate Pass To': gatePass.toName,
        'Gate Pass Permission': gatePass.permissionText,
        'Gate Pass Item': gatePass.item,
        'Gate Pass Quantity': gatePass.quantity,
        'Gate Pass Generated': gatePassGenerated,
        'Sales History Finalized': finalize,
        'Delivery Finalized': finalize,
        'Delivery Date': gatePass.date,
      }
      if (workItem?.id) {
        await api.patch(`/work-items/${workItem.id}/payload`, payload)
      } else {
        await api.post('/modules/delivery/work-items', payload)
      }
      await load()
      toast.success(finalize ? 'Sales History finalized' : 'Sales History saved')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not save Sales History')
    } finally {
      setLoading(false)
    }
  }

  const saveGatePass = async () => {
    if (!validateGatePass()) return
    if (!selectedVehicle) {
      toast.error('Select a vehicle first')
      return
    }
    try {
      const payload = {
        ...historyValues,
        'Vehicle Code': selectedVehicle.code,
        'Gate Pass Job Card No': gatePass.jobCardNo,
        'Gate Pass Date': gatePass.date,
        'Gate Pass Time': gatePass.time,
        'Gate Pass To': gatePass.toName,
        'Gate Pass Permission': gatePass.permissionText,
        'Gate Pass Item': gatePass.item,
        'Gate Pass Quantity': gatePass.quantity,
        'Gate Pass Generated': true,
      }
      if (workItem?.id) {
        await api.patch(`/work-items/${workItem.id}/payload`, payload)
      } else {
        await api.post('/modules/delivery/work-items', payload)
      }
      await load()
      toast.success('Gate Pass generated')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not generate Gate Pass')
    }
  }

  const uploadDocument = async (id: string, file?: File) => {
    if (!file) return
    await api.patch(`/documents/${id}/upload`, await fileToUploadPayload(file))
    await load()
    toast.success(`${file.name} uploaded`)
  }

  const viewDocument = async (id: string, fileName?: string | null) => {
    if (!fileName) return
    const { data } = await api.get(`/documents/${id}/file`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const printGatePass = () => {
    if (!validateGatePass()) return
    const gatePassCard = document.getElementById('gate-pass-print-card')
    if (!gatePassCard) {
      toast.error('Gate Pass preview is not ready')
      return
    }
    const printWindow = window.open('', '_blank', 'width=640,height=860')
    if (!printWindow) {
      toast.error('Allow popup access to print the Gate Pass')
      return
    }
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Gate Pass</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: flex-start;
              justify-content: center;
              background: #ffffff;
              color: #001b52;
              font-family: Arial, Helvetica, sans-serif;
            }
            .print-wrap {
              width: 480px;
              margin: 6px auto;
            }
            .gate-pass-card {
              border: 2px solid #173783;
              padding: 30px 26px;
              color: #001b52;
              min-height: 665px;
            }
            .text-center { text-align: center; }
            .title { margin: 0; font-size: 26px; font-weight: 700; }
            .address { margin: 6px 0 0; font-size: 15px; line-height: 1.35; }
            .gate-title { margin: 30px 0 0; font-size: 30px; font-weight: 700; text-decoration: underline; }
            .top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 34px; font-size: 20px; }
            .job-no { color: #b5121b; font-size: 30px; font-weight: 700; line-height: 1.35; }
            .stack { display: grid; gap: 18px; }
            .line { border-bottom: 1px dotted #173783; padding-bottom: 12px; }
            .to-line { margin-top: 38px; font-size: 20px; }
            .permission { margin-top: 30px; font-size: 22px; line-height: 1.8; }
            .item-line { margin-top: 28px; font-size: 20px; }
            .qty { float: right; }
            .signature { margin-top: 82px; font-size: 20px; font-weight: 700; }
            @page { size: auto; margin: 8mm; }
          </style>
        </head>
        <body>
          <div class="print-wrap">${gatePassCard.innerHTML}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const acceptForDocument = (name: string) => {
    if (name === 'Video Byte') return '.mp4,.mov,video/mp4,video/quicktime'
    if (name === 'Tractor Invoice' || name === 'Quotation') return '.pdf,application/pdf'
    if (name === 'Delivery Photo') return 'image/*,.png,.jpg,.jpeg'
    return 'image/*,.png,.jpg,.jpeg,.pdf,application/pdf'
  }

  const updateHistoryField = (field: string, value: string) => {
    const normalizedValue = field === 'PAN Number' ? value.toUpperCase() : value
    setHistoryValues((current) => ({ ...current, [field]: normalizedValue }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const maxLengthForField = (field: string) => {
    if (field === 'Aadhaar Number') return 12
    if (field === 'Mobile Number') return 10
    if (field === 'PAN Number') return 10
    return undefined
  }

  const historyField = (field: string, label = field, className = '', type = 'text') => (
    <label className={`space-y-1 ${className}`}>
      <span className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
        {requiredHistoryFields.includes(field) ? <span className="text-red-600">*</span> : null}
      </span>
      <input
        id={fieldKey(field)}
        type={type}
        value={historyValues[field] ?? ''}
        onChange={(event) => updateHistoryField(field, event.target.value)}
        maxLength={maxLengthForField(field)}
        className={`h-9 w-full border px-3 text-sm outline-none focus:border-green-900 ${errors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-[#fff7d6]'}`}
      />
      {errors[field] ? <p className="text-[10px] font-semibold text-red-600">{errors[field]}</p> : null}
    </label>
  )

  const historyTextArea = (field: string, label = field, rows = 3) => (
    <label className="space-y-1">
      <span className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
        {requiredHistoryFields.includes(field) ? <span className="text-red-600">*</span> : null}
      </span>
      <textarea
        id={fieldKey(field)}
        value={historyValues[field] ?? ''}
        onChange={(event) => updateHistoryField(field, event.target.value)}
        rows={rows}
        className={`w-full resize-none border px-3 py-2 text-sm outline-none focus:border-green-900 ${errors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-[#fff7d6]'}`}
      />
      {errors[field] ? <p className="text-[10px] font-semibold text-red-600">{errors[field]}</p> : null}
    </label>
  )

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-[100px]">
      <div className="mx-auto max-w-[1380px] px-8 py-8">
        {!pageReady ? <section className="mb-6 border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading Sales History data...</section> : null}

        {loadIssue ? (
          <section className="mb-6 border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Sales History Flow Note</p>
            <p className="mt-2 text-sm text-amber-800">{loadIssue}</p>
              <button onClick={() => navigate('/installation')} className="mt-4 border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Open Installation Certificate
            </button>
          </section>
        ) : null}

        <section className="mb-4 border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Select Vehicle</span>
              <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} className="h-9 w-full border border-slate-200 bg-[#fff7d6] px-3 text-sm outline-none focus:border-green-900">
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.code} - {vehicle.model}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer</p>
              <p className="mt-2 text-xl font-semibold text-green-950">{selectedVehicle?.customer?.name ?? 'Unassigned'}</p>
              <p className="text-sm text-slate-500">{selectedVehicle?.customer?.mobile ?? 'Mobile not captured'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Vehicle</p>
              <p className="mt-2 text-xl font-semibold text-green-950">{selectedVehicle?.model ?? 'Select vehicle'}</p>
              <p className="font-mono text-sm text-slate-500">{selectedVehicle?.chassisNo ?? '--'}</p>
            </div>
          </div>
        </section>

        <section className="mb-4 border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Agreement</p>
              <h2 className="text-xl font-semibold text-green-950">Agreement & Customer History Details</h2>
            </div>
            <label className={`flex items-center gap-3 border px-4 py-2 text-xs font-bold uppercase tracking-wider ${errors['Customer Agreement Accepted'] ? 'border-red-500 text-red-700' : 'border-green-900 text-green-950'}`}>
              <input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} className="h-4 w-4 accent-green-900" />
              Agreement Accepted
            </label>
          </div>

          {errors['Gate Pass'] ? <p className="mb-3 border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{errors['Gate Pass']}</p> : null}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr_1.15fr]">
            <div className="space-y-3 border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Dealer & Customer</p>
              {historyTextArea('Selling Dealer Name and Stamp', "Selling Dealer's Name and Stamp", 3)}
              {historyTextArea('Customer Address', 'Name of Customer and Address', 5)}
              <div className="grid gap-3 md:grid-cols-2">
                {historyField('Customer Name')}
                {historyField('Mobile Number')}
                {historyField('Aadhaar Number')}
                {historyField('PAN Number')}
                {historyField('Reference / Key Person', 'Reference / Key Person', 'md:col-span-2')}
                {historyField('Office / SM / DSP Name', 'Office / SM / DSP Name', 'md:col-span-2')}
              </div>
            </div>

            <div className="space-y-3 border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tractor Details</p>
              {historyField('Tractor Serial Number', 'Tractor Serial No')}
              {historyField('Model')}
              {historyField('FIP Number', 'FIP No.')}
              {historyField('Date of Installation', 'Date of Installation', '', 'date')}
            </div>

            <div className="space-y-3 border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Engine, Battery & Tyres</p>
              <div className="grid gap-3 md:grid-cols-2">
                {historyField('Engine Number', 'Engine Serial No.')}
                {historyField('Battery SN', 'Battery No.')}
                {historyField('Battery Make', 'Battery Make')}
                {historyField('OIB Number', 'OIB No.')}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tyre No. & Make</p>
                <div className="overflow-hidden border border-slate-200">
                  <div className="grid grid-cols-[80px_1fr_1fr_1fr] bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    <div className="border-r border-slate-200 px-2 py-2" />
                    <div className="border-r border-slate-200 px-2 py-2">Left</div>
                    <div className="border-r border-slate-200 px-2 py-2">Right</div>
                    <div className="px-2 py-2">Make</div>
                  </div>
                  {[
                    ['Front', 'Front Tyre LH', 'Front Tyre RH', 'Front Tyre Make'],
                    ['Rear', 'Rear Tyre LH', 'Rear Tyre RH', 'Rear Tyre Make'],
                  ].map(([label, left, right, make]) => (
                    <div key={label} className="grid grid-cols-[80px_1fr_1fr_1fr] border-t border-slate-200">
                      <div className="border-r border-slate-200 px-2 py-2 text-xs font-bold uppercase text-slate-600">{label}</div>
                      {[left, right, make].map((field) => (
                        <input
                          key={field}
                          value={historyValues[field] ?? ''}
                          onChange={(event) => updateHistoryField(field, event.target.value)}
                          className="h-9 min-w-0 border-r border-slate-200 bg-[#fff7d6] px-2 text-sm outline-none last:border-r-0 focus:bg-[#ffefad]"
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {historyField('Tyre Make', 'Common Tyre Make')}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4 border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Voucher, Sheets, Documents & Media</p>
              <h2 className="text-xl font-semibold text-green-950">{uploadedDocCount} / {salesDocuments.length} Uploaded</h2>
            </div>
            <button type="button" onClick={() => setGatePassOpen(true)} className="border border-green-900 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-green-950">
              Generate Gate Pass
            </button>
          </div>

          <div className="space-y-4">
            {docSections.map((section) => (
              <div key={section}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{section}</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {visibleDocuments.filter((document) => document.section === section).map((document) => (
                    <div key={document.name} className={`border p-3 ${document.fileName ? 'border-green-200 bg-green-50/40' : 'border-dashed border-slate-300 bg-white'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-green-950">{document.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{document.fileName ?? document.formats}</p>
                          <p className="mt-1 text-xs text-slate-400">{document.note}</p>
                        </div>
                        <span className={`material-symbols-outlined ${document.fileName ? 'text-green-900' : 'text-slate-300'}`}>
                          {document.fileName ? 'task_alt' : 'upload_file'}
                        </span>
                      </div>
                      {document.active ? (
                        <div className="mt-4 flex flex-wrap gap-3">
                          {document.fileName ? (
                            <button type="button" onClick={() => viewDocument(document.id, document.fileName)} className="text-xs font-bold uppercase tracking-wider text-green-900">
                              View
                            </button>
                          ) : null}
                          <label className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-600">
                            {document.fileName ? 'Re-upload' : 'Upload'}
                            <input type="file" accept={acceptForDocument(document.name)} className="hidden" onChange={(event) => uploadDocument(document.id, event.target.files?.[0])} />
                          </label>
                        </div>
                      ) : (
                        <p className="mt-4 text-xs font-semibold text-amber-700">Save Sales History once to unlock this upload slot.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {gatePassOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-6">
          <div className="max-h-[92vh] w-full max-w-[980px] overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Gate Pass</p>
                <h2 className="text-xl font-semibold text-green-950">Generate Gate Pass</h2>
              </div>
              <button type="button" onClick={() => setGatePassOpen(false)} className="material-symbols-outlined text-slate-500">close</button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
              <div className="grid content-start gap-3 md:grid-cols-2">
                {[
                  ['Job Card No', 'jobCardNo'],
                  ['Date', 'date'],
                  ['Time', 'time'],
                  ['To', 'toName'],
                  ['Permission Text', 'permissionText'],
                  ['Model / Spares / Items', 'item'],
                  ['Quantity', 'quantity'],
                ].map(([label, key]) => (
                  <label key={key} className={`space-y-2 ${key === 'permissionText' ? 'md:col-span-2' : ''}`}>
                    <span className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {label}
                      <span className="text-red-600">*</span>
                    </span>
                    <input
                      type={key === 'date' ? 'date' : key === 'time' ? 'time' : 'text'}
                      value={gatePass[key as keyof GatePassDraft]}
                      onChange={(event) => {
                        setGatePass((current) => ({ ...current, [key]: event.target.value }))
                        setGatePassErrors((current) => {
                          const next = { ...current }
                          delete next[key as keyof GatePassDraft]
                          return next
                        })
                      }}
                      className={`h-9 w-full border px-3 text-sm outline-none focus:border-green-900 ${gatePassErrors[key as keyof GatePassDraft] ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-[#fff7d6]'}`}
                    />
                    {gatePassErrors[key as keyof GatePassDraft] ? <p className="text-[10px] font-semibold text-red-600">{gatePassErrors[key as keyof GatePassDraft]}</p> : null}
                  </label>
                ))}
              </div>

              <div id="gate-pass-print-card">
                <div className="gate-pass-card border-2 border-blue-900 p-5 text-blue-950">
                <div className="text-center">
                  <p className="title text-xl font-bold">OM GANESH TRACTORS</p>
                  <p className="address text-xs">Shankar Mutt Road, Shimoga - 1, Phone: 08182-274741, 593967</p>
                  <p className="gate-title mt-5 text-2xl font-bold underline">GATE PASS</p>
                </div>
                <div className="top-grid mt-6 grid grid-cols-2 gap-5 text-sm">
                  <p>Job card No. <span className="job-no text-2xl font-bold text-red-700">{gatePass.jobCardNo || '____'}</span></p>
                  <div className="stack space-y-2">
                    <p>Date: {gatePass.date || '__________'}</p>
                    <p>Time: {gatePass.time || '__________'}</p>
                  </div>
                </div>
                <p className="to-line line mt-8 border-b border-dotted border-blue-900 pb-2">To, {gatePass.toName || '________________________________'}</p>
                <p className="permission mt-5 leading-8">
                  {gatePass.permissionText || 'is permitted to take out of the Workshop / our premises'}
                </p>
                <p className="item-line line mt-5 border-b border-dotted border-blue-900 pb-2">
                  Model/Spares/Items: {gatePass.item || '________________'} <span className="qty float-right">Qnty. {gatePass.quantity || '___'}</span>
                </p>
                <p className="signature mt-16 text-right font-semibold">WorkShop / Incharge / Authorised Signature</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={printGatePass} className="border border-slate-300 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Print / Save PDF
              </button>
              <button type="button" onClick={saveGatePass} className="bg-green-900 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white">
                Save Generated Gate Pass
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
        <div className="text-sm font-semibold text-slate-600">
          {agreementAccepted ? 'Agreement accepted' : 'Agreement pending'} | {gatePassGenerated ? 'Gate pass generated' : 'Gate pass pending'} | {uploadedDocCount}/{salesDocuments.length} files
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => saveSalesHistory(false)} disabled={loading || !selectedVehicle} className="border border-green-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-green-950 disabled:border-slate-300 disabled:text-slate-400">
            Save Sales History
          </button>
          <button type="button" onClick={() => saveSalesHistory(true)} disabled={loading || !selectedVehicle || !agreementAccepted} className="bg-green-900 px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white disabled:bg-slate-200 disabled:text-slate-400">
            Finalize
          </button>
        </div>
      </footer>
    </div>
  )
}
