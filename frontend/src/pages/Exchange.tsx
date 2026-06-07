import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { fileToUploadPayload } from '../lib/upload'

type Row = {
  id: string
  status: string
  amount?: number | null
  payload?: string | null
  documents?: { id: string; name: string; status: string; fileName?: string | null }[]
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
  permissionText: 'is permitted to take out of the workshop / premises',
  item: '',
  quantity: '1',
}

const initial = {
  Dealership: '',
  'Dealer Exchange Champion': '',
  'Hot Prospect Name': '',
  'Mobile Number': '',
  'Previous Owner': '',
  'Name / Address 1': '',
  'Name / Address 2': '',
  'Insurance Number': '',
  'Insurance Provider': '',
  'Insurance Due Date': '',
  'Tractor RC Number': '',
  'Trailer Attached': 'false',
  'Trailer RC Number': '',
  'Ownership Chain': '',
  'Loan / Hypothecation': '',
  Make: '',
  Model: '',
  Year: '',
  'Hours on Meter': '',
  'Hour Meter Seal / Warranty Status': '',
  'Tax Paid Details': '',
  'Insurance Details': '',
  'Any Other Information': '',
  'Engine Number': '',
  'Chassis Number': '',
  'Price Matrix A': '',
  'Offered Price': '',
  'Actual Deduction B': '',
  'Evaluated Price A-B': '',
  'Liquidation Target Price': '',
  'Old Tractor Stock Number': '',
  'Accounts Ledger Number': '',
  'Accounts Book Link': '',
  'Broker / End Customer': '',
  'Liquidation Name': '',
  'Liquidation Mobile': '',
  'Liquidation Address': '',
  'Liquidation Date': '',
  'TEP Name 1': '',
  'TEP Mobile 1': '',
  'TEP Quote 1': '',
  'TEP Name 2': '',
  'TEP Mobile 2': '',
  'TEP Quote 2': '',
  'Form 28 Availability': '',
  'Form 29 Availability': '',
  'Form 30 Availability': '',
  'Form 35 Availability': '',
}

const exchangeDocuments = [
  'Insurance Copy',
  'Tractor RC',
  'Old Tractor Agreement Copy',
  'Old Tractor Stock Proof',
  'Accounts Ledger Copy',
  'Old Tractor Gate Pass',
  'Form 28',
  'Form 29',
  'Form 30',
  'Form 35',
]

const trailerDocuments = ['Trailer RC']

const technicalRows = [
  { check: 'Colour', performance: 'Actual', percent: '0 - 20 %', standard: '-10000', actualHint: '', groupRows: 3 },
  { check: 'Colour', performance: '(Left)', percent: '20 - 50 %', standard: '-8000', actualHint: '' },
  { check: 'Colour', performance: 'Repaint', percent: '', standard: '-20000', actualHint: '' },
  { check: 'Sheet Metal', performance: 'Bonnet', percent: '', standard: '-4000', actualHint: '', groupRows: 2 },
  { check: 'Sheet Metal', performance: 'Fender', percent: '', standard: '-2000', actualHint: '' },
  { check: 'Tyre Condition', performance: 'F / R', percent: '0 - 20 %', standard: '-8000', frontStandard: 'F-3000', rearStandard: 'R-5000', actualHint: 'F-     R-', groupRows: 3 },
  { check: 'Tyre Condition', performance: 'F / R', percent: '20 - 50%', standard: '-6000', frontStandard: 'F-2000', rearStandard: 'R-4000', actualHint: 'F-     R-' },
  { check: 'Tyre Condition', performance: 'Remould', percent: '', standard: '-10000', frontStandard: 'F-4000', rearStandard: 'R-6000', actualHint: 'F-     R-' },
  { check: 'Engine', performance: 'Smoke', percent: '', standard: '-8000', actualHint: '', groupRows: 1 },
  { check: 'Gear Box', performance: '', percent: '', standard: '-2000', actualHint: '', groupRows: 1 },
  { check: 'Differential', performance: '', percent: '', standard: '-2000', actualHint: '', groupRows: 1 },
  { check: 'Battery', performance: 'Starting Problem', percent: '', standard: '-3000', actualHint: '', groupRows: 1 },
  { check: 'Other Check Points', performance: 'Clutch', percent: '', standard: '-2000', actualHint: '', groupRows: 3 },
  { check: 'Other Check Points', performance: 'Brake', percent: '', standard: '-2000', actualHint: '' },
  { check: 'Other Check Points', performance: 'Steering', percent: '', standard: '-2000', actualHint: '' },
]

const requiredFields = ['Previous Owner', 'Mobile Number', 'Insurance Number', 'Make', 'Model', 'Engine Number', 'Chassis Number', 'Price Matrix A', 'Evaluated Price A-B']
const requiredGatePassFields: Array<keyof GatePassDraft> = ['jobCardNo', 'date', 'time', 'toName', 'permissionText', 'item', 'quantity']

function parsePayload(payload?: string | null) {
  try { return payload ? JSON.parse(payload) : {} } catch { return {} }
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

export default function Exchange() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [selectedRowId, setSelectedRowId] = useState('')
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [reductions, setReductions] = useState<Record<string, string>>({})
  const [otherInfo, setOtherInfo] = useState<Record<string, string>>({})
  const [gatePass, setGatePass] = useState<GatePassDraft>(initialGatePass)
  const [gatePassOpen, setGatePassOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [gatePassErrors, setGatePassErrors] = useState<Partial<Record<keyof GatePassDraft, string>>>({})
  const [loading, setLoading] = useState(false)
  const [exchangeRequired, setExchangeRequired] = useState(true)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: true,
    evaluation: true,
    liquidation: true,
    uploads: true,
    recent: true,
  })

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedRowId) ?? rows[0] ?? null, [rows, selectedRowId])
  const selectedPayload = useMemo(() => parsePayload(selectedRow?.payload), [selectedRow])
  const trailerAttached = String(values['Trailer Attached'] ?? 'false') === 'true'

  const load = async () => {
    const { data } = await api.get('/modules/exchange/work-items')
    setRows(data)
    if (!selectedRowId && data[0]?.id) setSelectedRowId(data[0].id)
  }

  useEffect(() => { load().catch(() => toast.error('Could not load exchange records')) }, [])

  useEffect(() => {
    if (!selectedRow) return
    const payload = parsePayload(selectedRow.payload)
    setValues({ ...initial, ...payload })
    setGatePass({
      jobCardNo: String(payload['Old Tractor Gate Pass Job Card No'] ?? ''),
      date: String(payload['Old Tractor Gate Pass Date'] ?? ''),
      time: String(payload['Old Tractor Gate Pass Time'] ?? ''),
      toName: String(payload['Old Tractor Gate Pass To'] ?? payload['Previous Owner'] ?? ''),
      permissionText: String(payload['Old Tractor Gate Pass Permission'] ?? initialGatePass.permissionText),
      item: String(payload['Old Tractor Gate Pass Item'] ?? `${payload.Make ?? ''} ${payload.Model ?? ''}`.trim()),
      quantity: String(payload['Old Tractor Gate Pass Quantity'] ?? '1'),
    })
    setReductions(Object.fromEntries(technicalRows.flatMap((row) => {
      const key = `${row.check}:${row.performance}:${row.percent}`
      return row.check === 'Tyre Condition'
        ? [
            [`${key}:F`, String(payload[`Reduction:${key}:F`] ?? '')],
            [`${key}:R`, String(payload[`Reduction:${key}:R`] ?? '')],
          ]
        : [[key, String(payload[`Reduction:${key}`] ?? '')]]
    })))
    setOtherInfo(Object.fromEntries(technicalRows.map((row) => [`${row.check}:${row.performance}:${row.percent}`, String(payload[`Other Info:${row.check}:${row.performance}:${row.percent}`] ?? '')])))
  }, [selectedRow])

  const selectedDocuments = useMemo(() => {
    const documentNames = trailerAttached ? [...exchangeDocuments, ...trailerDocuments] : exchangeDocuments
    return documentNames.map((name) => {
      const live = selectedRow?.documents?.find((doc) => doc.name === name)
      return { name, id: live?.id ?? '', fileName: live?.fileName ?? null, active: Boolean(live) }
    })
  }, [selectedRow, trailerAttached])

  const updateValue = (field: string, value: string) => {
    const numeric = ['Year', 'Hours on Meter', 'Price Matrix A', 'Offered Price', 'Actual Deduction B', 'Evaluated Price A-B', 'Liquidation Target Price', 'TEP Quote 1', 'TEP Quote 2'].includes(field)
    setValues((current) => ({ ...current, [field]: numeric ? value.replace(/[^\d.]/g, '') : value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const input = (field: string, label = field, type = 'text', className = '') => (
    <label className={`space-y-1 ${className}`}>
      <span className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
        {requiredFields.includes(field) ? <span className="text-red-600">*</span> : null}
      </span>
      <input
        type={type}
        value={values[field] ?? ''}
        disabled={!exchangeRequired}
        onChange={(event) => updateValue(field, event.target.value)}
        className={`h-8 w-full border px-2 text-sm outline-none focus:border-green-900 ${errors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-[#fff7d6]'}`}
      />
      {errors[field] ? <p className="text-[10px] font-semibold text-red-600">{errors[field]}</p> : null}
    </label>
  )

  const toggleSection = (section: string) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  const sectionHeader = (section: string, title: string, action?: ReactNode) => (
    <div className="flex items-center justify-between gap-4">
      <button type="button" onClick={() => toggleSection(section)} className="flex items-center gap-2 text-left">
        <span className="material-symbols-outlined text-lg text-green-900">
          {openSections[section] ? 'expand_less' : 'expand_more'}
        </span>
        <h2 className="text-lg font-semibold text-green-950">{title}</h2>
      </button>
      {action}
    </div>
  )

  const validateExchange = () => {
    if (!exchangeRequired) return true
    const nextErrors: Record<string, string> = {}
    requiredFields.forEach((field) => {
      if (!String(values[field] ?? '').trim()) nextErrors[field] = 'Required'
    })
    if (values['Mobile Number'] && digits(values['Mobile Number']).length !== 10) nextErrors['Mobile Number'] = 'Enter 10 digits'
    if (values['Insurance Due Date'] && Number.isNaN(Date.parse(values['Insurance Due Date']))) nextErrors['Insurance Due Date'] = 'Invalid date'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast.error('Please fix highlighted exchange fields')
      return false
    }
    return true
  }

  const validateGatePass = () => {
    const nextErrors: Partial<Record<keyof GatePassDraft, string>> = {}
    requiredGatePassFields.forEach((field) => {
      if (!String(gatePass[field] ?? '').trim()) nextErrors[field] = 'Required'
    })
    if (gatePass.quantity && (!/^\d+$/.test(gatePass.quantity) || Number(gatePass.quantity) < 1)) nextErrors.quantity = 'Use a valid quantity'
    setGatePassErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast.error('Please fix highlighted gatepass fields')
      return false
    }
    return true
  }

  const buildPayload = (extra: Record<string, string | boolean> = {}) => {
    const technicalPayload = Object.fromEntries([
      ...Object.entries(reductions).map(([key, value]) => [`Reduction:${key}`, value]),
      ...Object.entries(otherInfo).map(([key, value]) => [`Other Info:${key}`, value]),
    ])
    return {
      ...values,
      'Trailer Attached': trailerAttached ? 'true' : 'false',
      ...(!trailerAttached ? { 'Trailer RC Number': '' } : {}),
      ...technicalPayload,
      'Old Tractor Gate Pass Job Card No': gatePass.jobCardNo,
      'Old Tractor Gate Pass Date': gatePass.date,
      'Old Tractor Gate Pass Time': gatePass.time,
      'Old Tractor Gate Pass To': gatePass.toName,
      'Old Tractor Gate Pass Permission': gatePass.permissionText,
      'Old Tractor Gate Pass Item': gatePass.item,
      'Old Tractor Gate Pass Quantity': gatePass.quantity,
      ...extra,
    }
  }

  const submit = async () => {
    if (!exchangeRequired) {
      toast.success('Exchange skipped')
      navigate('/safety')
      return
    }
    if (!validateExchange()) return
    setLoading(true)
    try {
      await api.post('/modules/exchange/work-items', buildPayload())
      toast.success('Exchange registry entry created')
      setValues(initial)
      setReductions({})
      setOtherInfo({})
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not create exchange record')
    } finally {
      setLoading(false)
    }
  }

  const updateExisting = async (extra: Record<string, string | boolean> = {}) => {
    if (!exchangeRequired) {
      toast.error('Turn Exchange Step on to edit data')
      return false
    }
    if (!selectedRow?.id) {
      toast.error('Create the exchange record first')
      return false
    }
    await api.patch(`/work-items/${selectedRow.id}/payload`, buildPayload(extra))
    await load()
    return true
  }

  const saveGatePass = async () => {
    if (!validateGatePass()) return
    try {
      const saved = selectedRow?.id ? await updateExisting({ 'Old Tractor Gate Pass Generated': true }) : false
      if (!saved) return
      toast.success('Old tractor gatepass generated')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not save old tractor gatepass')
    }
  }

  const printGatePass = () => {
    if (!validateGatePass()) return
    const card = document.getElementById('old-tractor-gatepass-print')
    const printWindow = window.open('', '_blank', 'width=640,height=860')
    if (!card || !printWindow) {
      toast.error('Unable to open print preview')
      return
    }
    printWindow.document.write(`<!doctype html><html><head><title>Old Tractor Gate Pass</title><style>
      *{box-sizing:border-box} body{margin:0;display:flex;justify-content:center;font-family:Arial,Helvetica,sans-serif;color:#001b52}
      .wrap{width:480px;margin:8px auto}.gate-pass-card{border:2px solid #173783;padding:30px 26px;min-height:665px}
      .text-center{text-align:center}.title{margin:0;font-size:26px;font-weight:700}.address{font-size:15px;line-height:1.35}
      .gate-title{margin:30px 0 0;font-size:30px;font-weight:700;text-decoration:underline}.top-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:34px;font-size:20px}
      .job-no{color:#b5121b;font-size:30px;font-weight:700}.stack{display:grid;gap:18px}.line{border-bottom:1px dotted #173783;padding-bottom:12px}
      .to-line{margin-top:38px;font-size:20px}.permission{margin-top:30px;font-size:22px;line-height:1.8}.item-line{margin-top:28px;font-size:20px}.qty{float:right}.signature{margin-top:82px;font-size:20px;font-weight:700}
      @page{margin:8mm}
    </style></head><body><div class="wrap">${card.innerHTML}</div></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
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

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1500px] space-y-5 px-8 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] font-bold text-[#00450d]">Exchange Registry</h1>
            <p className="text-slate-500">Old tractor documents, stock entry, account ledger link, evaluation, and gatepass.</p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="border border-slate-200 bg-white px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Exchange Step</p>
              <button
                type="button"
                role="switch"
                aria-checked={exchangeRequired}
                onClick={() => {
                  setExchangeRequired((current) => {
                    const next = !current
                    if (!next) setGatePassOpen(false)
                    return next
                  })
                }}
                className="mt-2 flex items-center gap-3 text-left"
              >
                <span className={`relative h-6 w-11 rounded-full transition-colors ${exchangeRequired ? 'bg-green-900' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${exchangeRequired ? 'left-6' : 'left-1'}`} />
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                  {exchangeRequired ? 'Required' : 'Skip Exchange'}
                </span>
              </button>
            </div>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Open Entry</span>
              <select value={selectedRow?.id ?? ''} onChange={(event) => setSelectedRowId(event.target.value)} className="h-9 min-w-[280px] border border-slate-200 bg-[#fff7d6] px-3 text-sm outline-none focus:border-green-900">
                {rows.map((row) => {
                  const payload = parsePayload(row.payload)
                  return <option key={row.id} value={row.id}>{payload['Previous Owner'] || row.id} - {payload.Model || 'Exchange'}</option>
                })}
              </select>
            </label>
          </div>
        </div>

        {!exchangeRequired ? (
          <section className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Exchange is switched off for this sale. Data entry is locked and this optional step can be skipped.
          </section>
        ) : null}

        <div className={exchangeRequired ? 'space-y-5' : 'space-y-5 opacity-55 pointer-events-none'}>
        <section className="border border-slate-200 bg-white p-4">
          {sectionHeader('info', 'Document, Insurance & Stock Info',
            <button type="button" disabled={!exchangeRequired} onClick={() => setGatePassOpen(true)} className="border border-green-900 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-green-950 disabled:border-slate-300 disabled:text-slate-400">Generate Old Tractor Gatepass</button>,
          )}
          {openSections.info ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
              {input('Previous Owner')}
              {input('Mobile Number')}
              {input('Insurance Number')}
              {input('Insurance Provider')}
              {input('Insurance Due Date', 'Insurance Due', 'date')}
              {input('Tractor RC Number')}
              <label className="flex h-8 items-center gap-3 border border-slate-200 bg-[#fff7d6] px-3 text-sm font-semibold text-green-950">
                <input
                  type="checkbox"
                  checked={trailerAttached}
                  disabled={!exchangeRequired}
                  onChange={(event) => updateValue('Trailer Attached', event.target.checked ? 'true' : 'false')}
                  className="h-4 w-4 accent-green-900 disabled:opacity-60"
                />
                Trailor attached?
              </label>
              {trailerAttached ? input('Trailer RC Number') : null}
              {input('Old Tractor Stock Number')}
              {input('Accounts Ledger Number')}
              {input('Accounts Book Link')}
              {input('Loan / Hypothecation')}
            </div>
          ) : null}
        </section>

        <section className="border border-slate-200 bg-white p-4">
          {sectionHeader('evaluation', 'Evaluation Sheet')}
          {openSections.evaluation ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="grid gap-2 md:grid-cols-3">
                {input('Dealership')}
                {input('Dealer Exchange Champion')}
                {input('Hot Prospect Name')}
                {input('Name / Address 1')}
                {input('Name / Address 2')}
                {input('Make')}
                {input('Model')}
                {input('Year')}
                {input('Hours on Meter')}
                {input('Hour Meter Seal / Warranty Status')}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {input('Tax Paid Details')}
                {input('Insurance Details')}
                {input('Any Other Information')}
                {input('Form 28 Availability')}
                {input('Form 29 Availability')}
                {input('Form 30 Availability')}
                {input('Form 35 Availability')}
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid gap-2 md:grid-cols-3">
                {input('Engine Number', 'Engine No.')}
                {input('Chassis Number')}
                {input('Price Matrix A')}
                {input('Actual Deduction B')}
                {input('Evaluated Price A-B')}
                {input('Offered Price')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse border border-slate-400 text-[12px] text-slate-800">
                  <thead>
                    <tr className="bg-slate-50 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                      <th className="border border-slate-400 px-2 py-2">Check Points</th>
                      <th className="border border-slate-400 px-2 py-2" colSpan={2}>Performance Checks</th>
                      <th className="border border-slate-400 px-2 py-2" colSpan={3}>Standard Reduction (*)</th>
                      <th className="border border-slate-400 px-2 py-2" colSpan={2}>Actual Reduction</th>
                      <th className="border border-slate-400 px-2 py-2">Other Information</th>
                    </tr>
                  </thead>
                  <tbody>
                    {technicalRows.map((row) => {
                      const key = `${row.check}:${row.performance}:${row.percent}`
                      return (
                        <tr key={key}>
                          {row.groupRows ? (
                            <td rowSpan={row.groupRows} className="border border-slate-400 px-2 py-1 align-middle font-semibold text-slate-700">
                              {row.check}
                            </td>
                          ) : null}
                          <td className="border border-slate-400 px-2 py-1">{row.performance}</td>
                          <td className="border border-slate-400 px-2 py-1">{row.percent}</td>
                          {row.frontStandard || row.rearStandard ? (
                            <>
                              <td className="border border-slate-400 px-2 py-1 font-mono">{row.standard}</td>
                              <td className="border border-slate-400 px-2 py-1 font-mono">{row.frontStandard ?? ''}</td>
                              <td className="border border-slate-400 px-2 py-1 font-mono">{row.rearStandard ?? ''}</td>
                            </>
                          ) : (
                            <td className="border border-slate-400 px-2 py-1 font-mono" colSpan={3}>{row.standard}</td>
                          )}
                          {row.check === 'Tyre Condition' ? (
                            <>
                              <td className="border border-slate-400 bg-[#fff7d6] p-0">
                                <input
                                  value={reductions[`${key}:F`] ?? ''}
                                  onChange={(event) => setReductions((current) => ({ ...current, [`${key}:F`]: event.target.value }))}
                                  placeholder="F-"
                                  className="h-8 w-full min-w-[58px] bg-[#fff7d6] px-2 text-sm outline-none focus:bg-[#ffefad]"
                                />
                              </td>
                              <td className="border border-slate-400 bg-[#fff7d6] p-0">
                                <input
                                  value={reductions[`${key}:R`] ?? ''}
                                  onChange={(event) => setReductions((current) => ({ ...current, [`${key}:R`]: event.target.value }))}
                                  placeholder="R-"
                                  className="h-8 w-full min-w-[58px] bg-[#fff7d6] px-2 text-sm outline-none focus:bg-[#ffefad]"
                                />
                              </td>
                            </>
                          ) : (
                            <td className="border border-slate-400 bg-[#fff7d6] p-0" colSpan={2}>
                              <input
                                value={reductions[key] ?? ''}
                                onChange={(event) => setReductions((current) => ({ ...current, [key]: event.target.value }))}
                                className="h-8 w-full min-w-[116px] bg-[#fff7d6] px-2 text-sm outline-none focus:bg-[#ffefad]"
                              />
                            </td>
                          )}
                          <td className="border border-slate-400 bg-[#fff7d6] p-0">
                            <input
                              value={otherInfo[key] ?? ''}
                              onChange={(event) => setOtherInfo((current) => ({ ...current, [key]: event.target.value }))}
                              className="h-8 w-full min-w-[120px] bg-[#fff7d6] px-2 text-sm outline-none focus:bg-[#ffefad]"
                            />
                          </td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-bold" colSpan={6}>Actual Deduction - B</td>
                      <td className="border border-slate-400 bg-[#fff7d6] p-0" colSpan={3}>
                        <input
                          value={values['Actual Deduction B'] ?? ''}
                          onChange={(event) => updateValue('Actual Deduction B', event.target.value)}
                          className="h-8 w-full bg-[#fff7d6] px-2 text-sm outline-none focus:bg-[#ffefad]"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-bold" colSpan={6}>Evaluated Price (A-B)</td>
                      <td className="border border-slate-400 bg-[#fff7d6] p-0" colSpan={3}>
                        <input
                          value={values['Evaluated Price A-B'] ?? ''}
                          onChange={(event) => updateValue('Evaluated Price A-B', event.target.value)}
                          className={`h-8 w-full px-2 text-sm outline-none focus:bg-[#ffefad] ${errors['Evaluated Price A-B'] ? 'bg-red-50' : 'bg-[#fff7d6]'}`}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          ) : null}
        </section>

        <section className="border border-slate-200 bg-white p-4">
          {sectionHeader('liquidation', 'Live Market Price & Liquidation Details')}
          {openSections.liquidation ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {input('TEP Name 1')}
              {input('TEP Mobile 1')}
              {input('TEP Quote 1')}
              {input('TEP Name 2')}
              {input('TEP Mobile 2')}
              {input('TEP Quote 2')}
              {input('Broker / End Customer')}
              {input('Liquidation Name')}
              {input('Liquidation Mobile')}
              {input('Liquidation Address')}
              {input('Liquidation Date', 'Liquidation Date', 'date')}
              {input('Liquidation Target Price')}
            </div>
          ) : null}
        </section>

        <section className="border border-slate-200 bg-white p-4">
          {sectionHeader('uploads', 'Uploads')}
          {openSections.uploads ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {selectedDocuments.map((doc) => (
              <div key={doc.name} className={`border p-3 ${doc.fileName ? 'border-green-200 bg-green-50/40' : 'border-dashed border-slate-300 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-green-950">{doc.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{doc.fileName ?? 'PDF, JPG, PNG'}</p>
                  </div>
                  <span className={`material-symbols-outlined ${doc.fileName ? 'text-green-900' : 'text-slate-300'}`}>{doc.fileName ? 'task_alt' : 'upload_file'}</span>
                </div>
                {doc.active ? (
                  <div className="mt-3 flex gap-3">
                    {doc.fileName ? <button type="button" onClick={() => viewDocument(doc.id, doc.fileName)} className="text-xs font-bold uppercase tracking-wider text-green-900">View</button> : null}
                    <label className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-600">
                      {doc.fileName ? 'Re-upload' : 'Upload'}
                      <input type="file" accept="image/*,.png,.jpg,.jpeg,.pdf,application/pdf" className="hidden" onChange={(event) => uploadDocument(doc.id, event.target.files?.[0])} />
                    </label>
                  </div>
                ) : <p className="mt-3 text-xs font-semibold text-amber-700">Create exchange record to unlock upload.</p>}
              </div>
            ))}
          </div>
          ) : null}
        </section>
        </div>

        <section className="border border-slate-200 bg-white p-4">
          {sectionHeader('recent', 'Recent Exchange Entries')}
          {openSections.recent ? (
          <div className="mt-3 overflow-hidden border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1b5e20] text-[11px] uppercase tracking-widest text-white">
                <tr>
                  <th className="px-4 py-3">Previous Owner</th>
                  <th className="px-4 py-3">Machine</th>
                      <th className="px-4 py-3">Tractor RC / Insurance</th>
                  <th className="px-4 py-3 text-right">Evaluated</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const payload = parsePayload(row.payload)
                  return (
                    <tr key={row.id} onClick={() => setSelectedRowId(row.id)} className={`cursor-pointer ${selectedRowId === row.id ? 'bg-green-50' : index % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                      <td className="px-4 py-3">{payload['Previous Owner'] || '-'}</td>
                      <td className="px-4 py-3">{payload.Make || '-'} {payload.Model || '-'}</td>
                      <td className="px-4 py-3">{payload['Tractor RC Number'] || '-'} / {payload['Insurance Number'] || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">Rs {Number(payload['Evaluated Price A-B'] || row.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3"><span className="bg-[#ffdcc2] px-2 py-1 text-[10px] font-bold uppercase text-[#6d3a00]">{row.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length ? <div className="p-5 text-sm text-slate-500">No exchange entries yet.</div> : null}
          </div>
          ) : null}
        </section>
      </div>

      {gatePassOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-6">
          <div className="max-h-[92vh] w-full max-w-[980px] overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Old Tractor Gatepass</p>
                <h2 className="text-xl font-semibold text-green-950">Generate Gatepass</h2>
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
                  <label key={key} className={`space-y-1 ${key === 'permissionText' ? 'md:col-span-2' : ''}`}>
                    <span className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}<span className="text-red-600">*</span></span>
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
              <div id="old-tractor-gatepass-print">
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
                  <p className="permission mt-5 leading-8">{gatePass.permissionText || initialGatePass.permissionText}</p>
                  <p className="item-line line mt-5 border-b border-dotted border-blue-900 pb-2">
                    Model/Spares/Items: {gatePass.item || '________________'} <span className="qty float-right">Qnty. {gatePass.quantity || '___'}</span>
                  </p>
                  <p className="signature mt-16 text-right font-semibold">WorkShop / Incharge / Authorised Signature</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={printGatePass} className="border border-slate-300 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">Print / Save PDF</button>
              <button type="button" onClick={saveGatePass} className="bg-green-900 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white">Save Gatepass</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex justify-between gap-3 border-t border-slate-200 bg-white px-8 py-4">
        <div className="text-sm font-semibold text-slate-600">
          {exchangeRequired
            ? `${selectedDocuments.filter((doc) => doc.fileName).length}/${selectedDocuments.length} files | Ledger: ${values['Accounts Ledger Number'] || 'pending'} | Stock: ${values['Old Tractor Stock Number'] || 'pending'}`
            : 'Exchange skipped for this sale'}
        </div>
        <div className="flex gap-3">
          <button onClick={() => updateExisting().then((saved) => saved && toast.success('Exchange entry updated'))} disabled={!exchangeRequired || !selectedRow?.id} className="border border-green-900 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-green-950 disabled:border-slate-300 disabled:text-slate-400">
            Update Entry
          </button>
          <button onClick={submit} disabled={loading} className="bg-[#1b5e20] px-8 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
            {!exchangeRequired ? 'Skip Exchange' : loading ? 'Saving...' : 'Record Exchange'}
          </button>
        </div>
      </div>
    </div>
  )
}
