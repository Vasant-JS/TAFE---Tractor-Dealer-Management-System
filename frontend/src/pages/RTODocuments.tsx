import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { fileToUploadPayload } from '../lib/upload'

const templateDocuments = ['RC Card', 'Aadhaar Card', 'Form 19-22', 'GST Invoice', 'Bonafide Cert', 'Bank Form 35', 'Passport Photo', 'Shaddow Trace']

const iconByDoc: Record<string, string> = {
  'RC Card': 'badge',
  'Aadhaar Card': 'fingerprint',
  'Form 19-22': 'article',
  'GST Invoice': 'receipt_long',
  'Bonafide Cert': 'approval',
  'Bank Form 35': 'account_balance',
  'Passport Photo': 'account_box',
  'Shaddow Trace': 'content_paste_search',
}

const helpByDoc: Record<string, string> = {
  'RC Card': 'Vehicle registration number',
  'Aadhaar Card': 'Proof of identity and address for RTO records.',
  'Form 19-22': 'Statutory RTO application forms for new registration.',
  'GST Invoice': 'Original purchase invoice with tax breakdown.',
  'Bonafide Cert': 'Local residence verification from competent authority.',
  'Bank Form 35': 'Hypothecation termination/addition for financed vehicles.',
  'Passport Photo': 'Recent passport size photograph of the applicant.',
  'Shaddow Trace': 'RTO shadow trace / chassis imprint support document.',
}

const fieldsByDoc: Record<string, string[]> = {
  'RC Card': ['Vehicle Registration Number'],
  'Aadhaar Card': ['Customer Aadhaar'],
  'Form 19-22': ['Form 20', 'Form 21', 'Form 22'],
  'GST Invoice': ['Tax Receipt'],
  'Bonafide Cert': ['Bonafide Certificate Number'],
  'Bank Form 35': ['Dealer Authorization', 'RTO Clerk'],
}

type Vehicle = {
  id: string
  code: string
  model: string
  status: string
  registrationNo?: string | null
  customer?: {
    id: string
    name: string
    aadhaar?: string | null
    pan?: string | null
  } | null
}

type WorkItem = {
  id: string
  status: string
  payload?: string | null
  vehicle?: Vehicle | null
  customer?: Vehicle['customer']
  documents?: Array<{ id: string; name: string; status: string; fileName?: string | null }>
}

const eligibleStatuses = ['Safety Acknowledged', 'Safety Completed', 'RTO Verification In Progress', 'RTO Filed', 'Insured', 'Financially Closed', 'Closed']

export default function RTODocuments() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? searchParams.get('vehid') ?? ''

  const [module, setModule] = useState<any>(null)
  const [rows, setRows] = useState<WorkItem[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [newDocName, setNewDocName] = useState('')
  const [loading, setLoading] = useState(false)
  const [editUnlocked, setEditUnlocked] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [loadIssue, setLoadIssue] = useState('')

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const current = useMemo(
    () => rows.find((row) => row.vehicle?.id === selectedVehicleId) ?? rows.find((row) => row.vehicle?.id === requestedVehicleId) ?? null,
    [rows, selectedVehicleId, requestedVehicleId],
  )

  const documents = current?.documents?.length
    ? [
        ...current.documents,
        ...templateDocuments
          .filter((name) => !current.documents?.some((doc) => doc.name === name))
          .map((name) => ({ id: name, name, status: 'Pending', fileName: '' })),
      ]
    : templateDocuments.map((name) => ({ id: name, name, status: 'Pending', fileName: '' }))

  const uploaded = documents.filter((doc: any) => doc.status === 'Uploaded').length
  const progress = documents.length ? Math.round((uploaded / documents.length) * 100) : 0
  const requiredTotal = Math.max(documents.length, 10)
  const statusText = current ? current.status : 'Create RTO Record'
  const isSubmitted = current?.status === 'Verification In Progress'
  const isEditing = !isSubmitted || editUnlocked

  const payload = useMemo(() => {
    try {
      return current?.payload ? JSON.parse(current.payload) : {}
    } catch {
      return {}
    }
  }, [current])

  const customerOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const vehicle of vehicles) {
      if (vehicle.customer?.id) map.set(vehicle.customer.id, { id: vehicle.customer.id, name: vehicle.customer.name })
    }
    return Array.from(map.values())
  }, [vehicles])

  const selectedCustomerId = selectedVehicle?.customer?.id ?? ''

  const valueFor = (field: string) => {
    if (field === 'Customer Name') return selectedVehicle?.customer?.name ?? payload[field] ?? ''
    if (field === 'Vehicle Model') return selectedVehicle?.model ?? payload[field] ?? ''
    if (field === 'Vehicle Code') return selectedVehicle?.code ?? payload[field] ?? ''
    if (field === 'Vehicle Registration Number') return formValues[field] ?? selectedVehicle?.registrationNo ?? payload[field] ?? ''
    if (field === 'Customer Aadhaar') return formValues[field] ?? selectedVehicle?.customer?.aadhaar ?? payload[field] ?? ''
    if (field === 'PAN') return formValues[field] ?? selectedVehicle?.customer?.pan ?? payload[field] ?? ''
    return formValues[field] ?? payload[field] ?? ''
  }

  const updateField = (field: string, value: string) => {
    let nextValue = value
    if (/aadhaar/i.test(field)) nextValue = value.replace(/\D/g, '').slice(0, 12)
    if (/pan/i.test(field)) nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    setFormValues((currentValues) => ({ ...currentValues, [field]: nextValue }))
  }

  const load = async () => {
    const [moduleResponse, rowsResponse, vehicleResponse] = await Promise.allSettled([api.get('/modules/rto'), api.get('/modules/rto/work-items'), api.get('/vehicles')])

    if (moduleResponse.status === 'fulfilled') setModule(moduleResponse.value.data)
    if (rowsResponse.status === 'fulfilled') setRows(rowsResponse.value.data)

    const liveVehicles = vehicleResponse.status === 'fulfilled' ? vehicleResponse.value.data : []
    const rtoEligible = liveVehicles.filter((vehicle: Vehicle) => eligibleStatuses.includes(vehicle.status) && vehicle.customer?.id)
    setVehicles(rtoEligible)

    if (requestedVehicleId && rtoEligible.some((vehicle: Vehicle) => vehicle.id === requestedVehicleId)) {
      setSelectedVehicleId(requestedVehicleId)
    } else if (!requestedVehicleId) {
      setSelectedVehicleId('')
    } else {
      setSelectedVehicleId('')
    }

    if (moduleResponse.status === 'rejected' && rowsResponse.status === 'rejected') {
      setLoadIssue('RTO data is temporarily unavailable. Refresh once the backend is up.')
    } else if (!rtoEligible.length && (!rowsResponse || rowsResponse.status !== 'fulfilled' || rowsResponse.value.data.length === 0)) {
      setLoadIssue('No vehicle is ready for RTO yet. Complete Safety & Maintenance first, then start the RTO packet.')
    } else {
      setLoadIssue('')
    }
    setPageReady(true)
  }

  useEffect(() => {
    load().catch(() => {
      setLoadIssue('RTO data is temporarily unavailable. Refresh once the backend is up.')
      setPageReady(true)
    })
  }, [requestedVehicleId])

  useEffect(() => {
    setFormValues({})
    setNewDocName('')
    setEditUnlocked(false)
  }, [selectedVehicleId, current?.id])

  const selectCustomer = (customerId: string) => {
    const matchingVehicle = vehicles.find((vehicle) => vehicle.customer?.id === customerId)
    if (matchingVehicle) setSelectedVehicleId(matchingVehicle.id)
  }

  const selectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId)
  }

  const saveDraft = async () => {
    if (!selectedVehicle) {
      toast.error('Select a vehicle first')
      return
    }
    setLoading(true)
    try {
      const nextPayload = {
        ...formValues,
        'Vehicle Code': selectedVehicle.code,
        'Vehicle Details': selectedVehicle.code,
        'Vehicle Model': selectedVehicle.model,
        'Customer Name': selectedVehicle.customer?.name ?? '',
        'Vehicle Registration Number': valueFor('Vehicle Registration Number'),
        'Customer Aadhaar': valueFor('Customer Aadhaar'),
        PAN: valueFor('PAN'),
      }
      if (current) {
        await api.patch(`/work-items/${current.id}/payload`, nextPayload)
        toast.success('RTO packet saved')
      } else {
        await api.post('/modules/rto/work-items', nextPayload)
        toast.success('RTO record created')
      }
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not save RTO record')
    } finally {
      setLoading(false)
    }
  }

  const submitForVerification = async () => {
    if (!current) {
      toast.error('Save the RTO record first')
      return
    }
    await api.patch(`/work-items/${current.id}/status`, { status: 'Verification In Progress' })
    await load()
    setEditUnlocked(false)
    toast.success('Submitted for verification')
  }

  const rejectSet = async () => {
    if (!current) {
      toast.error('Create the RTO record first')
      return
    }
    try {
      await api.patch(`/work-items/${current.id}/status`, { status: 'Rejected' })
      await load()
      setEditUnlocked(true)
      toast.success('RTO set rejected. You can edit and re-submit it now.')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not reject RTO set')
    }
  }

  const uploadDocument = async (id: string, file?: File) => {
    if (!file) return
    if (!current) {
      toast.error('Save the RTO record before uploading documents')
      return
    }
    try {
      await api.patch(`/documents/${id}/upload`, await fileToUploadPayload(file))
      await load()
      toast.success(`${file.name} uploaded`)
    } catch (error: any) {
      if (error.response?.status === 413) {
        toast.error('This file is too large for the current upload limit. Try a smaller file or image.')
      } else {
        toast.error(error.response?.data?.message ?? 'Could not upload document')
      }
    }
  }

  const removeDocument = async (id: string) => {
    await api.patch(`/documents/${id}/remove`)
    await load()
    toast.success('Document removed')
  }

  const viewDocument = async (id: string, fileName?: string | null) => {
    if (!fileName) return
    const { data } = await api.get(`/documents/${id}/file`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const addOtherDocument = async () => {
    if (!current) {
      toast.error('Save the RTO record first')
      return
    }
    if (!newDocName.trim()) {
      toast.error('Enter document name')
      return
    }
    await api.post(`/work-items/${current.id}/documents`, { name: newDocName.trim() })
    setNewDocName('')
    await load()
    toast.success('Document added')
  }

  if (!module && !pageReady) {
    return (
      <div className="p-6">
        <div className="rounded border border-outline-variant bg-white p-5 text-sm text-on-surface-variant">Loading RTO data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-white pb-[96px]">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-8 p-8">
        {loadIssue ? (
          <section className="rounded border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-amber-900">RTO Flow Note</p>
            <p className="mt-2 text-sm text-amber-800">{loadIssue}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => navigate('/safety')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open Safety
              </button>
              <button onClick={() => navigate('/guided-flow')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open Guided Flow
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_320px]">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">Select Customer</span>
              <select
                value={selectedCustomerId}
                onChange={(event) => selectCustomer(event.target.value)}
                className="h-11 w-full rounded-sm border border-[#dbe3ee] px-3 text-sm outline-none focus:border-[#1b5e20]"
              >
                <option value="">Choose customer</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">Select Vehicle</span>
              <select
                value={selectedVehicleId}
                onChange={(event) => selectVehicle(event.target.value)}
                className="h-11 w-full rounded-sm border border-[#dbe3ee] px-3 text-sm outline-none focus:border-[#1b5e20]"
              >
                <option value="">Choose vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.code} - {vehicle.model}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-sm border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">Current Status</p>
              <p className="mt-2 font-display text-[14px] font-medium uppercase text-[#005219]">{selectedVehicle?.status ?? 'Select vehicle'}</p>
              <p className="mt-1 text-[11px] text-[#60708a]">{selectedVehicle?.customer?.name ?? 'Customer will appear from previous completed steps.'}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-[#e2e8f0] bg-white">
          <div className="grid min-h-[110px] gap-0 lg:grid-cols-[1fr_224px] xl:grid-cols-[1fr_300px]">
            <div className="border-l-4 border-[#1b5e20] px-6 py-7">
              <div className="flex h-full flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#1b5e20]">Customer</p>
                    <p className="min-w-[220px] flex-1 font-display text-[20px] font-medium leading-none text-[#262626]">
                      {selectedVehicle?.customer?.name ?? 'Select customer / vehicle'}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#60708a]">
                    <span className="material-symbols-outlined text-[14px]">agriculture</span>
                    <span>{selectedVehicle?.model ?? 'Vehicle model will appear here'}</span>
                    <span>|</span>
                    <span className="font-bold text-[#005219]">{valueFor('Vehicle Registration Number') || 'Reg. No.'}</span>
                  </div>
                </div>
                <div className="w-full lg:w-[300px]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#71809b]">Documentation Progress</span>
                    <span className="font-mono text-[12px] font-bold text-[#00450d]">
                      {uploaded} of {requiredTotal}
                    </span>
                  </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#edf2f7]">
                    <div className="h-full bg-[#1b5e20]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-6 lg:border-l lg:border-t-0">
              <span className="material-symbols-outlined material-symbols-filled text-[34px] text-[#1b5e20]">verified</span>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-[#71809b]">Status</p>
              <p className="mt-1 font-display text-[14px] font-medium uppercase leading-tight text-[#005219]">{statusText}</p>
              {!current ? (
                <button
                  onClick={saveDraft}
                  disabled={loading || !selectedVehicle}
                  className="mt-4 h-9 min-w-[170px] rounded-sm bg-[#1b5e20] px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create RTO Record'}
                </button>
              ) : isSubmitted && !editUnlocked ? (
                <button
                  onClick={() => setEditUnlocked(true)}
                  className="mt-4 h-9 min-w-[170px] rounded-sm border border-[#1b5e20] bg-white px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1b5e20]"
                >
                  Edit RTO Packet
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">Vehicle Registration Number</span>
              <input
                value={valueFor('Vehicle Registration Number')}
                onChange={(event) => updateField('Vehicle Registration Number', event.target.value.toUpperCase())}
                disabled={!isEditing}
                className="h-11 w-full rounded-sm border border-[#dbe3ee] px-3 font-mono text-[11px] outline-none focus:border-[#1b5e20]"
                placeholder="Enter registration number"
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">Customer Aadhaar</span>
              <input
                value={valueFor('Customer Aadhaar')}
                onChange={(event) => updateField('Customer Aadhaar', event.target.value)}
                disabled={!isEditing}
                className="h-11 w-full rounded-sm border border-[#dbe3ee] px-3 font-mono text-[11px] outline-none focus:border-[#1b5e20]"
                placeholder="Enter customer Aadhaar"
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">PAN</span>
              <input
                value={valueFor('PAN')}
                onChange={(event) => updateField('PAN', event.target.value)}
                disabled={!isEditing}
                className="h-11 w-full rounded-sm border border-[#dbe3ee] px-3 font-mono text-[11px] uppercase outline-none focus:border-[#1b5e20]"
                placeholder="Enter PAN"
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">RTO Submission Deadline</span>
              <input
                value={valueFor('RTO Submission Deadline')}
                onChange={(event) => updateField('RTO Submission Deadline', event.target.value)}
                type="date"
                disabled={!isEditing}
                className="h-11 w-full rounded-sm border border-[#dbe3ee] px-3 font-mono text-[11px] outline-none focus:border-[#1b5e20]"
              />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {documents.map((doc: any) => {
            const isUploaded = doc.status === 'Uploaded'
            const docFields = fieldsByDoc[doc.name] ?? []
            return (
              <div
                key={doc.id}
                className={`relative rounded bg-white p-5 ${doc.name === 'RC Card' ? 'min-h-[224px]' : 'min-h-[196px]'} ${
                  isUploaded ? 'border border-[#b7d2bc] shadow-[0_1px_3px_rgba(0,0,0,0.16)]' : 'border border-dashed border-[#cbd8e6] bg-[#f8fafc]'
                }`}
              >
                {isUploaded ? <div className="absolute right-0 top-0 bg-[#1b5e20] px-3 py-1 text-[10px] font-medium uppercase text-white">Uploaded</div> : null}
                <div className="flex gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${isUploaded ? 'bg-[#e8f9e8] text-[#1b5e20]' : 'bg-[#e8edf3] text-[#9badc1]'}`}>
                    <span className="material-symbols-outlined text-[22px]">{iconByDoc[doc.name] ?? 'add_circle'}</span>
                  </div>
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className={`font-display text-[14px] font-medium leading-none ${isUploaded ? 'text-[#262626]' : 'text-[#728096]'}`}>{doc.name}</h3>
                    <p className="mt-2.5 text-[11px] leading-normal text-[#71809b]">{helpByDoc[doc.name] ?? 'Additional RTO requirement.'}</p>
                    {docFields.length ? (
                      <div className={`mt-3 grid gap-2 ${docFields.length === 3 ? 'grid-cols-3' : docFields.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {docFields.map((field) => (
                          <input
                            key={field}
                            value={valueFor(field)}
                            onChange={(event) => updateField(field, event.target.value)}
                            disabled={!isEditing}
                            className="h-9 min-w-0 rounded-sm border border-[#dbe3ee] bg-[#f8fafc] px-3 font-mono text-[11px] text-[#262626] outline-none placeholder:text-[#9aa7b8] focus:border-[#1b5e20]"
                            placeholder={field}
                          />
                        ))}
                      </div>
                    ) : null}
                    {doc.fileName ? (
                      <div className="mt-3 flex h-8 items-center rounded-sm border border-[#edf2f7] bg-[#f8fafc] px-3 text-sm text-[#60708a]">
                        <span className="material-symbols-outlined mr-2 text-[14px] text-[#9badc1]">description</span>
                        <span className="truncate text-[11px]">{doc.fileName}</span>
                      </div>
                    ) : (
                      current ? (
                        isEditing ? (
                        <label className="mt-4 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm border border-[#d7e0ea] bg-white text-[10px] font-bold uppercase tracking-wide text-[#2d7138]">
                          <span className="material-symbols-outlined text-[14px]">upload</span>
                          Upload Document
                          <input type="file" className="hidden" onChange={(event) => uploadDocument(doc.id, event.target.files?.[0])} />
                        </label>
                        ) : (
                          <div className="mt-4 flex h-9 items-center justify-center gap-2 rounded-sm border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            Locked After Submission
                          </div>
                        )
                      ) : (
                        <div className="mt-4 flex h-9 items-center justify-center gap-2 rounded-sm border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          <span className="material-symbols-outlined text-[14px]">lock</span>
                          Create RTO Record First
                        </div>
                      )
                    )}
                    {doc.fileName ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <button onClick={() => viewDocument(doc.id, doc.fileName)} className="flex h-10 items-center justify-center gap-2 rounded border border-[#1b5e20] bg-white text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          View
                        </button>
                        {isEditing ? (
                          <>
                            <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                              <span className="material-symbols-outlined text-[14px]">upload</span>
                              Re-upload
                              <input type="file" className="hidden" onChange={(event) => uploadDocument(doc.id, event.target.files?.[0])} />
                            </label>
                            <button onClick={() => removeDocument(doc.id)} className="flex h-10 items-center justify-center gap-2 rounded border border-red-200 bg-white text-[10px] font-bold uppercase tracking-wider text-red-700">
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                              Remove
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}

          <div className="relative min-h-[196px] rounded border border-dashed border-[#cbd8e6] bg-[#f8fafc] p-5">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-[#e8edf3] text-[#9badc1]">
                <span className="material-symbols-outlined text-[22px]">add_circle</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[14px] font-medium leading-none text-[#728096]">Add Other Document</h3>
                <p className="mt-2.5 text-[11px] text-[#71809b]">Insurance policy, PAN card, or other regional requirements.</p>
                <div className="mt-5 flex gap-2">
                  <input
                    value={newDocName}
                    onChange={(event) => setNewDocName(event.target.value)}
                    disabled={!isEditing}
                    className="h-9 min-w-0 flex-1 rounded-sm border border-[#d7e0ea] bg-white px-3 text-[11px] outline-none focus:border-[#1b5e20]"
                    placeholder="Enter document name"
                  />
                  <button onClick={addOtherDocument} disabled={!current || !isEditing} className="h-9 rounded-sm border border-[#d7e0ea] bg-white px-5 text-[10px] font-bold uppercase tracking-wide text-[#2d7138] disabled:cursor-not-allowed disabled:opacity-50">
                    Add New
                  </button>
                </div>
                {!current ? <p className="mt-3 text-[11px] text-slate-500">Click `Create RTO Record` once for this vehicle, then uploads and extra documents will unlock.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded border border-[#e2e8f0] bg-white p-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <label>
              <span className="mb-3 block text-xs font-bold uppercase tracking-wide text-[#71809b]">Verification Remarks</span>
              <textarea
                value={valueFor('Verification Remarks')}
                onChange={(event) => updateField('Verification Remarks', event.target.value)}
                disabled={!isEditing}
                className="h-[86px] w-full rounded-sm border border-[#dbe3ee] px-4 py-4 text-[11px] outline-none focus:border-[#1b5e20]"
                placeholder="Enter notes about document discrepancies or specific RTO instructions..."
              />
            </label>
            <div className="rounded-sm border border-[#e2e8f0] bg-[#f8fafc] px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#71809b]">Packet Ready</p>
              <p className="mt-2 text-sm text-[#475569]">{current ? 'You can continue uploading, reviewing, and re-submitting this RTO packet.' : 'Create the RTO record once, then the document packet will stay linked to this vehicle.'}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex h-16 items-center justify-between border-t border-[#e2e8f0] bg-white px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/insurance${selectedVehicleId ? `?vehicleId=${selectedVehicleId}` : ''}`)} disabled={!current} className="h-9 min-w-[120px] rounded-sm border border-slate-300 bg-white px-6 text-[10px] font-bold uppercase tracking-wide text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
            Next Step
          </button>
          <button onClick={saveDraft} disabled={loading || !selectedVehicle || !isEditing} className="h-9 min-w-[120px] rounded-sm border border-[#d7e0ea] bg-white px-6 text-[10px] font-bold uppercase tracking-wide text-[#60708a] disabled:opacity-60">
            {loading ? 'Saving...' : current ? 'Save Draft' : 'Create RTO Record'}
          </button>
          <button onClick={rejectSet} disabled={!current} className="h-9 min-w-[120px] rounded-sm border border-red-200 bg-white px-6 text-[10px] font-bold uppercase tracking-wide text-red-600 disabled:cursor-not-allowed disabled:opacity-50">
            Reject Set
          </button>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9badc1]">Required Documents</p>
            <p className="font-display text-[11px] font-medium text-[#1b5e20]">{progress}% Complete</p>
          </div>
          <button onClick={submitForVerification} disabled={!current || isSubmitted} className="h-9 min-w-[260px] rounded-sm bg-[#1b5e20] px-8 text-[10px] font-bold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitted ? 'Packet Locked' : 'Submit for Verification'}
          </button>
        </div>
      </div>
    </div>
  )
}
