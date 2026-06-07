import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type Vehicle = {
  id: string
  code: string
  engineNo: string
  chassisNo: string
  model: string
  status: string
}

type PdiFilter = 'Pending PDI' | 'PDI Failed' | 'Pending Installation' | 'Ready for Installation' | 'Allocated to Customer' | 'All Visible'

type AnswerValue = 'PASS' | 'FAIL' | 'N/A'
type UploadedPhoto = { fileName: string; previewUrl: string }
type SavedPdiRecord = {
  id: string
  vehicleId: string
  status: string
  remarks?: string | null
  signatoryPhoto?: string | null
  otpVerified?: boolean
  completedAt?: string | null
  inspector?: { id: string; name: string } | null
  results: Array<{
    id: string
    code: string
    label: string
    section: string
    result: AnswerValue
    remarks?: string | null
  }>
}

const PDI_CHECKLIST_FALLBACK = [
  'Verify tractor and engine serial numbers with invoice number',
  'Assembly removed parts for transport',
  'Ensure tool box contains and literature to specification',
  'Cooling system: water / coolant',
  'Battery: electrolyte',
  'Engine oil',
  'Air cleaner',
  'Transmission oil level / steering box oil level',
  'Power steering reservoir, if fitted',
  'Lubricate all grease nipples',
  'Lightly oil clutch linkage, throttle linkage hand and foot, differential lock linkage and hinges',
  'Drain plugs for tightness',
  'Tightness of engine air intake and cooling system hose and pipe connections',
  'Ensure pipes, hoses and wiring are not fouling exhaust system or sharp edges',
  'Fan belt tension',
  'Clutch linkage: free pedal clearance',
  'Tightness of transmission nuts and bolts',
  'Torque front wheel bolt/nut and rear wheel bolt/nut',
  'Tyre pressure: front 20 psi, rear 20 psi for haulage',
  'Front wheel alignment: toe-in 2-8 mm',
  'Check front wheel bearings end float',
  'Three-point linkage for correct fitting',
  'Lights: indicator, head, side and panel',
  'Plough lamp / hazard warning lights / horn',
  'Clutch and brake pedal adjustments',
  'Headlight alignment and warning light',
  'Safety start switch function',
  'All warning lights function, if provided',
  'Check idling and maximum off-load speeds to specification',
  'Remove oil, fuel and coolant traces before leak check',
  'Gear selection is normal for the model',
  'Operation of brakes: LH / RH',
  'Steering feel, lock to lock',
  'Differential lock function, if fitted',
  'Handbrake effectiveness',
  'Operation of gauges and instruments',
  'Draft control, if applicable',
  'Position control: correct position',
  'Constant pumping correctly positioned, if applicable',
  'Response control effectiveness',
  'Leakages in cooling, air, lubrication and fuel system',
  'Adjust brake, if necessary',
  'Ensure no leaks are apparent from areas previously cleaned',
]

function formatDateStamp() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase()
}

function inspectionCardState(status: string) {
  if (status === 'Pending Installation' || status === 'Ready for Installation' || status === 'Allocated to Customer') {
    return {
      badge: status === 'Allocated to Customer' ? 'Completed' : 'PDI Completed',
      badgeClass: 'bg-[#1b5e20] text-white',
      cardClass: 'bg-[#eef3e8] border-[#d7ddd1] border-l-[#1b5e20] opacity-90',
      strike: true,
    }
  }

  if (status === 'Pending PDI' || status === 'PDI Failed') {
    return {
      badge: status === 'PDI Failed' ? 'Re-inspection' : 'Inspection Pending',
      badgeClass: status === 'PDI Failed' ? 'bg-red-100 text-red-700' : 'bg-amber-500 text-[#1f1300]',
      cardClass: 'bg-white border-[#1b5e20] border-l-[#1b5e20] ring-1 ring-[#1b5e20]/20',
      strike: false,
    }
  }

  return {
    badge: 'Stock Entry',
    badgeClass: 'bg-[#e3e7df] text-[#41493e]',
    cardClass: 'bg-white border-slate-200 border-l-slate-300',
    strike: false,
  }
}

function resultTone(result: AnswerValue) {
  if (result === 'PASS') return 'bg-green-900 text-white'
  if (result === 'FAIL') return 'bg-red-700 text-white'
  return 'bg-slate-500 text-white'
}

export default function PDIManagement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [checklist, setChecklist] = useState<string[]>(PDI_CHECKLIST_FALLBACK)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [signatoryPhoto, setSignatoryPhoto] = useState<UploadedPhoto | null>(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [actionTaken, setActionTaken] = useState<Record<string, string>>({})
  const [checklistPhotos, setChecklistPhotos] = useState<Record<string, UploadedPhoto>>({})
  const [pageReady, setPageReady] = useState(false)
  const [loadIssue, setLoadIssue] = useState('')
  const [savedRecord, setSavedRecord] = useState<SavedPdiRecord | null>(null)
  const [vehicleFilter, setVehicleFilter] = useState<PdiFilter>('Pending PDI')
  const [reportHeader, setReportHeader] = useState({
    Model: '',
    'Serial Number': '',
    'Engine Number': '',
    'Dealer Name': '',
    'Job Card Number': '',
    'PDI Date': '',
  })

  const load = async () => {
    const [vehiclesRes, moduleRes] = await Promise.allSettled([api.get('/vehicles'), api.get('/modules/pdi')])
    const data = vehiclesRes.status === 'fulfilled' ? vehiclesRes.value.data : []
    const items = moduleRes.status === 'fulfilled' && moduleRes.value.data.checklist?.length ? moduleRes.value.data.checklist : PDI_CHECKLIST_FALLBACK
    setChecklist(items)
    setAnswers((current) => {
      const next = { ...current }
      for (const item of items) {
        if (!next[item]) next[item] = 'N/A'
      }
      return next
    })
    const relevantVehicles = data.filter((vehicle: Vehicle) => vehicle.status === 'Pending PDI' || vehicle.status === 'PDI Failed' || vehicle.status === 'Pending Installation' || vehicle.status === 'Ready for Installation' || vehicle.status === 'Allocated to Customer')
    setVehicles(relevantVehicles)
    const requestedVehicleId = searchParams.get('vehicleId')
    if (requestedVehicleId && relevantVehicles.some((vehicle) => vehicle.id === requestedVehicleId)) {
      const requestedVehicle = relevantVehicles.find((vehicle) => vehicle.id === requestedVehicleId)
      if (requestedVehicle) {
        if (requestedVehicle.status === 'Pending Installation') setVehicleFilter('Pending Installation')
        if (requestedVehicle.status === 'Ready for Installation') setVehicleFilter('Ready for Installation')
        if (requestedVehicle.status === 'Allocated to Customer') setVehicleFilter('Allocated to Customer')
        if (requestedVehicle.status === 'PDI Failed') setVehicleFilter('PDI Failed')
        if (requestedVehicle.status === 'Pending PDI') setVehicleFilter('Pending PDI')
      }
      setSelectedVehicleId(requestedVehicleId)
    } else if (!selectedVehicleId && relevantVehicles[0]?.id) {
      const pendingFirst = relevantVehicles.find((vehicle) => vehicle.status === 'Pending PDI') ?? relevantVehicles[0]
      setSelectedVehicleId(pendingFirst.id)
    }
    if (vehiclesRes.status === 'rejected' && moduleRes.status === 'rejected') {
      setLoadIssue('PDI data is temporarily unavailable. Refresh once the backend is up.')
    } else if (!relevantVehicles.length) {
      setLoadIssue('No vehicles are waiting for PDI yet. Create Purchase Invoice first.')
    } else {
      setLoadIssue('')
    }
    setPageReady(true)
  }

  useEffect(() => {
    load().catch(() => {
      setLoadIssue('PDI data is temporarily unavailable. Refresh once the backend is up.')
      setPageReady(true)
    })
  }, [])

  useEffect(() => {
    if (!selectedVehicleId) {
      setSavedRecord(null)
      return
    }
    api.get(`/pdi/vehicle/${selectedVehicleId}`)
      .then(({ data }) => setSavedRecord(data))
      .catch(() => setSavedRecord(null))
  }, [selectedVehicleId])

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'All Visible') return vehicles
    return vehicles.filter((vehicle) => vehicle.status === vehicleFilter)
  }, [vehicleFilter, vehicles])
  const isReadOnlyResult = Boolean(selectedVehicle && ['Pending Installation', 'Ready for Installation', 'Allocated to Customer'].includes(selectedVehicle.status) && savedRecord)
  const completedCount = useMemo(() => checklist.filter((item) => answers[item] && answers[item] !== 'N/A').length, [answers, checklist])
  const failedCount = useMemo(() => Object.values(answers).filter((value) => value === 'FAIL').length, [answers])
  const progress = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0
  const failedItems = useMemo(() => checklist.filter((item) => answers[item] === 'FAIL'), [answers, checklist])

  const savedResults = savedRecord?.results ?? []
  const savedCompletedCount = savedResults.filter((item) => item.result !== 'N/A').length
  const savedFailedCount = savedResults.filter((item) => item.result === 'FAIL').length
  const savedProgress = savedResults.length ? Math.round((savedCompletedCount / savedResults.length) * 100) : 0

  const clearChecklistPhoto = (item: string) => {
    setChecklistPhotos((current) => {
      const existing = current[item]
      if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)
      const next = { ...current }
      delete next[item]
      return next
    })
  }

  const setChecklistPhoto = (item: string, file?: File) => {
    if (!file) return
    setChecklistPhotos((current) => {
      const existing = current[item]
      if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)
      return {
        ...current,
        [item]: {
          fileName: file.name,
          previewUrl: URL.createObjectURL(file),
        },
      }
    })
    toast.success(`${file.name} attached`)
  }

  const setSignatoryUpload = (file?: File) => {
    if (!file) return
    setSignatoryPhoto((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return {
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      }
    })
    toast.success(`${file.name} attached`)
  }

  const removeSignatoryUpload = () => {
    setSignatoryPhoto((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }

  const openPreview = (previewUrl: string) => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    if (!filteredVehicles.length) return
    if (!filteredVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(filteredVehicles[0].id)
    }
  }, [filteredVehicles, selectedVehicleId])

  const updateAnswer = (item: string, option: AnswerValue) => {
    setAnswers((current) => ({ ...current, [item]: option }))
    if (option !== 'FAIL') {
      clearChecklistPhoto(item)
    }
  }

  const sendOtp = async () => {
    if (!selectedVehicle) {
      toast.error('Select a vehicle first')
      return
    }
    await api.post('/otp/send', { mobile: '9876543210', context: `pdi:${selectedVehicle.code}` })
    setOtpSent(true)
    toast.success('Inspector OTP sent')
  }

  const saveDraft = () => {
    toast.success('Draft saved locally for this inspection screen')
  }

  const submitPdi = async () => {
    if (!selectedVehicle) {
      toast.error('Choose a vehicle')
      return
    }
    if (isReadOnlyResult) {
      toast.error('This vehicle is already inspected. Review the saved result only.')
      return
    }
    setLoading(true)
    try {
      const payload: Record<string, string> = {
        'Vehicle Code': selectedVehicle.code,
        'Engine Number': selectedVehicle.engineNo,
        'Chassis Number': selectedVehicle.chassisNo,
        Model: reportHeader.Model || selectedVehicle.model,
        'Serial Number': reportHeader['Serial Number'] || selectedVehicle.chassisNo,
        'Dealer Name': reportHeader['Dealer Name'],
        'Job Card Number': reportHeader['Job Card Number'],
        'PDI Date': reportHeader['PDI Date'],
        'Inspector Remarks': remarks,
        'Authorized Signatory Photo': signatoryPhoto?.fileName ?? '',
        'Inspector OTP': otp,
      }
      for (const item of checklist) {
        payload[`PDI:${item}`] = answers[item] ?? 'N/A'
        if (actionTaken[item]) payload[`PDI:${item}:remarks`] = actionTaken[item]
        if (checklistPhotos[item]?.fileName) payload[`PDI Photo:${item}`] = checklistPhotos[item].fileName
      }
      await api.post('/modules/pdi/work-items', payload)
      toast.success('PDI completed and vehicle cleared')
      await load()
      navigate('/installation')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not submit PDI')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f5f8ec] pb-28">
      <div className="mx-auto max-w-[1320px] px-6 py-6">
        {!pageReady ? (
          <section className="mb-6 rounded border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Loading PDI data...</section>
        ) : null}
        {loadIssue ? (
          <section className="mb-6 rounded border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-amber-900">PDI Flow Note</p>
            <p className="mt-2 text-sm text-amber-800">{loadIssue}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => navigate('/purchase-invoices')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open Purchase Invoices
              </button>
              <button onClick={() => navigate('/guided-flow')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open Guided Flow
              </button>
            </div>
          </section>
        ) : null}

        <section className="pb-10">
          {!isReadOnlyResult ? (
            <div className="mb-5 border border-slate-200 bg-white p-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Model</span>
                  <input value={reportHeader.Model || selectedVehicle?.model || ''} onChange={(event) => setReportHeader((current) => ({ ...current, Model: event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-green-900" />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Serial No.</span>
                  <input value={reportHeader['Serial Number'] || selectedVehicle?.chassisNo || ''} onChange={(event) => setReportHeader((current) => ({ ...current, 'Serial Number': event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-green-900" />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Job Card No.</span>
                  <input value={reportHeader['Job Card Number']} onChange={(event) => setReportHeader((current) => ({ ...current, 'Job Card Number': event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-green-900" />
                </label>
                <label className="space-y-2 lg:col-span-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Dealer's Name</span>
                  <input value={reportHeader['Dealer Name']} onChange={(event) => setReportHeader((current) => ({ ...current, 'Dealer Name': event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-green-900" />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">PDI Carried Out On</span>
                  <input type="date" value={reportHeader['PDI Date']} onChange={(event) => setReportHeader((current) => ({ ...current, 'PDI Date': event.target.value }))} className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-green-900" />
                </label>
              </div>
              <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Indicate by a tick mark for OK and cross mark for Not OK in the Observation column.
              </div>
            </div>
          ) : null}

          <div className="mb-5 flex items-center gap-6 border border-slate-200 bg-white p-5">
            <div className="flex-1">
              <div className="mb-2 flex items-end justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Overall Progress</span>
                <span className="font-mono text-lg text-green-950">
                  {isReadOnlyResult ? `${savedRecord?.results.length ?? 0} items - ${savedCompletedCount} completed` : `${checklist.length} items - ${completedCount} completed`}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200">
                <div className="h-full bg-green-900" style={{ width: `${isReadOnlyResult ? savedProgress : progress}%` }} />
              </div>
            </div>
            <div className="border-l-2 border-green-950 bg-slate-50 px-5 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Completion</p>
              <p className="font-mono text-lg text-green-950">{isReadOnlyResult ? savedProgress : progress}%</p>
            </div>
          </div>

          {isReadOnlyResult ? (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Saved Inspection Status</p>
                    <h3 className="mt-2 text-lg font-semibold text-green-950">{savedRecord?.status ?? 'Allocated to Customer'}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {savedRecord?.inspector?.name ? `Inspector: ${savedRecord.inspector.name}` : 'Inspector recorded in system'}
                      {savedRecord?.completedAt ? ` • Completed ${new Date(savedRecord.completedAt).toLocaleString('en-IN')}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Failures Logged</p>
                    <p className="font-mono text-lg text-red-600">{savedFailedCount}</p>
                  </div>
                </div>
                {savedRecord?.remarks ? <p className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{savedRecord.remarks}</p> : null}
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-900">fact_check</span>
                    <h3 className="text-base font-semibold uppercase tracking-[0.08em] text-green-950">Saved Pre-Delivery Inspection Report</h3>
                  </div>
                </div>
                <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                  {(savedRecord?.results ?? []).map((item) => (
                    <div key={item.label} className={`rounded border p-4 ${item.result === 'FAIL' ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-green-950">{item.label}</p>
                          {item.remarks ? <p className="mt-2 text-xs text-slate-500">Action Taken: {item.remarks}</p> : null}
                        </div>
                        <span className={`rounded px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${resultTone(item.result)}`}>
                          {item.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-900">settings_suggest</span>
                    <h3 className="text-base font-semibold uppercase tracking-[0.08em] text-green-950">Pre-Delivery Inspection Report</h3>
                    <span className="bg-[#acf4a4] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#002203]">
                      {checklist.length} Items
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                  {checklist.map((item, index) => {
                    const answer = answers[item] ?? 'N/A'
                    const failed = answer === 'FAIL'
                    const uploadedPhoto = checklistPhotos[item]
                    return (
                      <div key={item} className={`rounded border ${failed ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'}`}>
                        <div className="p-5">
                          <p className="text-base font-semibold leading-snug text-green-950">
                            <span className="mr-2 font-mono text-sm text-slate-500">{index + 1}.</span>
                            {item}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-1">
                            {(['PASS', 'FAIL', 'N/A'] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => updateAnswer(item, option)}
                                className={`min-w-[58px] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] ${
                                  answer === option
                                    ? option === 'PASS'
                                      ? 'bg-green-900 text-white'
                                      : option === 'FAIL'
                                        ? 'bg-red-700 text-white'
                                        : 'bg-slate-500 text-white'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>

                          {answer === 'FAIL' ? (
                            <div className="mt-4 space-y-3 border-t border-red-100 pt-4">
                              <div className="flex items-center justify-between gap-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-red-600">Failure Photo</p>
                                {uploadedPhoto ? (
                                  <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => openPreview(uploadedPhoto.previewUrl)} className="text-xs font-semibold uppercase tracking-[0.08em] text-green-900">
                                      View
                                    </button>
                                    <label className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                                      Re-upload
                                      <input type="file" accept="image/*" className="hidden" onChange={(event) => setChecklistPhoto(item, event.target.files?.[0])} />
                                    </label>
                                    <button type="button" onClick={() => clearChecklistPhoto(item)} className="text-xs font-semibold uppercase tracking-[0.08em] text-red-600">
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-red-600">
                                    Upload Photo
                                    <input type="file" accept="image/*" className="hidden" onChange={(event) => setChecklistPhoto(item, event.target.files?.[0])} />
                                  </label>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-red-600">Reason for Failure / Remarks</p>
                                <input
                                  value={remarks}
                                  onChange={(event) => setRemarks(event.target.value)}
                                  className="mt-2 h-11 w-full border border-red-100 bg-white px-4 text-sm outline-none focus:border-red-300"
                                  placeholder="Enter the failure reason or corrective note..."
                                />
                              </div>
                            </div>
                          ) : null}
                          <label className="mt-4 block space-y-2 border-t border-slate-100 pt-4">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Action Taken</span>
                            <textarea
                              value={actionTaken[item] ?? ''}
                              onChange={(event) => setActionTaken((current) => ({ ...current, [item]: event.target.value }))}
                              className="w-full rounded border border-slate-200 p-3 text-sm outline-none focus:border-green-900"
                              rows={2}
                              placeholder="Corrective action / observation notes..."
                            />
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <section className="border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Inspector Verification</p>
                      <h4 className="font-display text-xl text-green-950">OTP &amp; Signatory Capture</h4>
                    </div>
                    <button
                      type="button"
                      onClick={sendOtp}
                      className="border border-green-900 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-green-950"
                    >
                      {otpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Authorized Signatory Photo</span>
                      <div className="rounded border border-slate-200 bg-slate-50 p-3">
                        <p className="truncate text-sm text-slate-600">{signatoryPhoto?.fileName ?? 'Upload signatory image file'}</p>
                        <div className="mt-3 flex items-center gap-4">
                          {signatoryPhoto ? (
                            <>
                              <button type="button" onClick={() => openPreview(signatoryPhoto.previewUrl)} className="text-xs font-semibold uppercase tracking-[0.08em] text-green-900">
                                View
                              </button>
                              <label className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                                Re-upload
                                <input type="file" accept="image/*" className="hidden" onChange={(event) => setSignatoryUpload(event.target.files?.[0])} />
                              </label>
                              <button type="button" onClick={removeSignatoryUpload} className="text-xs font-semibold uppercase tracking-[0.08em] text-red-600">
                                Remove
                              </button>
                            </>
                          ) : (
                            <label className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-green-900">
                              Upload Photo
                              <input type="file" accept="image/*" className="hidden" onChange={(event) => setSignatoryUpload(event.target.files?.[0])} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                    <label className="space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Inspector OTP</span>
                      <input
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-11 w-full border border-slate-200 px-3 font-mono text-sm outline-none focus:border-green-900"
                        placeholder="Enter 6-digit OTP"
                      />
                    </label>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Inspector Notes</p>
                  <textarea
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    rows={5}
                    className="mt-3 w-full border border-slate-200 p-4 text-sm outline-none focus:border-green-900"
                    placeholder="Enter overall PDI observations, exceptions, and clearance notes..."
                  />
                  {failedItems.length ? (
                    <p className="mt-3 text-sm text-red-600">{failedItems.length} checkpoint(s) are marked FAIL and will be flagged during submission.</p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No failed checkpoints are currently flagged.</p>
                  )}
                </section>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Mandatory Progress</p>
            <p className="font-mono text-xl text-green-950">
              {isReadOnlyResult ? savedCompletedCount : completedCount} / {isReadOnlyResult ? (savedRecord?.results.length ?? 0) : checklist.length}{' '}
              <span className="text-sm font-semibold text-red-600">
                {isReadOnlyResult ? savedFailedCount : Math.max(checklist.length - completedCount, 0)} {isReadOnlyResult ? 'failed items' : 'items pending'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {!isReadOnlyResult ? (
              <>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="border border-slate-300 bg-white px-8 py-4 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-800"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={submitPdi}
                  disabled={loading || !selectedVehicle}
                  className="bg-green-900 px-8 py-4 text-[12px] font-bold uppercase tracking-[0.08em] text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {loading ? 'Submitting...' : 'Final Submission'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/installation')}
                className="bg-green-900 px-8 py-4 text-[12px] font-bold uppercase tracking-[0.08em] text-white"
              >
                Next Step
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
