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

type LocalUpload = {
  fileName: string
  previewUrl: string
}

type DeliveryDraft = {
  deliveryDate: string
  deliveryItems: Record<string, boolean>
  agreementAccepted: boolean
  sectionSaved: {
    items: boolean
    agreement: boolean
  }
}

const deliveredItems = [
  'Tractor Unit (Cleaned)',
  'Ignition Keys (2 Sets)',
  'Operator Manual',
  'Standard Tool Kit',
  'Jack & Handle',
  'Warranty Booklet',
]

const deliveryDocumentGuide = [
  { name: 'Aadhaar Card', formats: 'JPG, PNG, PDF', note: 'Mandatory identity proof', size: 'max 5MB' },
  { name: 'PAN Card', formats: 'JPG, PNG, PDF', note: 'Mandatory PAN proof', size: 'max 5MB' },
  { name: 'Customer Photo', formats: 'JPG, PNG', note: 'Customer photo at handover', size: 'max 3MB' },
  { name: 'Delivery Photo', formats: 'JPG, PNG', note: 'Taken at the time of delivery', size: 'max 3MB' },
  { name: 'Delivery Challan', formats: 'JPG, PNG, PDF', note: 'Signed delivery challan copy', size: 'max 5MB' },
  { name: 'Gate Pass', formats: 'JPG, PNG, PDF', note: 'Vehicle gate pass copy', size: 'max 5MB' },
  { name: 'Tractor Invoice', formats: 'PDF', note: 'Original tractor invoice', size: 'max 10MB' },
  { name: 'Quotation', formats: 'PDF', note: 'Sales quotation copy', size: 'max 10MB' },
  { name: 'Video Byte', formats: 'MP4, MOV', note: 'Delivery moment video byte', size: 'max 50MB' },
] as const

export default function CustomerDelivery() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [deliveryItems, setDeliveryItems] = useState<Record<string, boolean>>(
    Object.fromEntries(deliveredItems.map((item) => [item, false])),
  )
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [signature, setSignature] = useState<LocalUpload | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [loadIssue, setLoadIssue] = useState('')
  const [sectionSaved, setSectionSaved] = useState({ items: false, agreement: false })
  const [editUnlocked, setEditUnlocked] = useState(false)

  const defaultDeliveryItems = useMemo(
    () => Object.fromEntries(deliveredItems.map((item) => [item, false])),
    [],
  )

  const parsePayload = (payload?: string | null) => {
    try {
      return payload ? JSON.parse(payload) : {}
    } catch {
      return {}
    }
  }

  const load = async () => {
    const [vehicleRes, workItemRes] = await Promise.allSettled([api.get('/vehicles'), api.get('/modules/delivery/work-items')])
    const vehicleRows = vehicleRes.status === 'fulfilled' ? vehicleRes.value.data : []
    const workItemRows = workItemRes.status === 'fulfilled' ? workItemRes.value.data : []
    const filtered = vehicleRows.filter((vehicle: Vehicle) => ['Allocated to Customer', 'Delivered', 'Safety Completed', 'Insured', 'RTO Verification In Progress', 'RTO Filed', 'Financially Closed', 'Closed'].includes(vehicle.status))
    setVehicles(filtered)
    setWorkItems(workItemRows)
    if (requestedVehicleId && filtered.some((vehicle: Vehicle) => vehicle.id === requestedVehicleId)) {
      setSelectedVehicleId(requestedVehicleId)
    } else if (!selectedVehicleId && filtered[0]?.id) {
      setSelectedVehicleId(filtered[0].id)
    }
    if (vehicleRes.status === 'rejected' && workItemRes.status === 'rejected') {
      setLoadIssue('Delivery data is temporarily unavailable. Refresh once the backend is up.')
    } else if (!filtered.length) {
      setLoadIssue('No vehicle is allocated to a customer yet. Complete Installation Certificate first.')
    } else {
      setLoadIssue('')
    }
    setPageReady(true)
  }

  useEffect(() => {
    load().catch(() => {
      setLoadIssue('Delivery data is temporarily unavailable. Refresh once the backend is up.')
      setPageReady(true)
    })
  }, [requestedVehicleId])

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const workItem = useMemo(() => workItems.find((item) => item.vehicleId === selectedVehicleId) ?? null, [selectedVehicleId, workItems])
  const workPayload = useMemo(() => parsePayload(workItem?.payload), [workItem])
  const isFinalized = Boolean(workPayload['Delivery Finalized'])
  const isEditing = !isFinalized || editUnlocked
  const missingItems = deliveredItems.filter((item) => !deliveryItems[item]).length
  const draftStorageKey = selectedVehicleId ? `delivery-draft-${selectedVehicleId}` : ''

  const saveDraftToStorage = (nextDraft: DeliveryDraft) => {
    if (!draftStorageKey || isFinalized) return
    localStorage.setItem(draftStorageKey, JSON.stringify(nextDraft))
  }

  useEffect(() => {
    if (!selectedVehicleId) return
    setEditUnlocked(false)
    const raw = draftStorageKey ? localStorage.getItem(draftStorageKey) : null
    const payload = parsePayload(workItem?.payload)
    const restoredItems = Object.fromEntries(
      deliveredItems.map((item) => [item, String(payload[item] ?? '').toLowerCase() === 'true' || Boolean(payload[item])]),
    )
    const hasAnyRestoredItem = Object.values(restoredItems).some(Boolean)
    const finalized = Boolean(payload['Delivery Finalized'])

    if (raw && !finalized) {
      try {
        const draft = JSON.parse(raw) as DeliveryDraft
        setDeliveryDate(draft.deliveryDate ?? '')
        setDeliveryItems(draft.deliveryItems ?? defaultDeliveryItems)
        setAgreementAccepted(Boolean(draft.agreementAccepted))
        setSectionSaved(draft.sectionSaved ?? { items: false, agreement: false })
      } catch {
        setDeliveryDate(String(payload['Delivery Date'] ?? ''))
        setDeliveryItems(hasAnyRestoredItem ? restoredItems : defaultDeliveryItems)
        setAgreementAccepted(Boolean(payload['Agreement Confirmation']))
        setSectionSaved({
          items: hasAnyRestoredItem,
          agreement: Boolean(payload['Agreement Confirmation']) && Boolean(payload['Customer Signature']),
        })
      }
      return
    }

    setDeliveryDate(String(payload['Delivery Date'] ?? ''))
    setDeliveryItems(hasAnyRestoredItem ? restoredItems : defaultDeliveryItems)
    setAgreementAccepted(Boolean(payload['Agreement Confirmation']))
    setSectionSaved({
      items: finalized || hasAnyRestoredItem,
      agreement: finalized || (Boolean(payload['Agreement Confirmation']) && Boolean(payload['Customer Signature'])),
    })
    if (!finalized && draftStorageKey) localStorage.removeItem(draftStorageKey)
  }, [defaultDeliveryItems, draftStorageKey, selectedVehicleId, workItem])

  useEffect(() => {
    return () => {
      if (signature?.previewUrl) URL.revokeObjectURL(signature.previewUrl)
    }
  }, [signature])

  const saveDeliveredItemsSection = async () => {
    if (!selectedVehicle) {
      toast.error('Select a vehicle first')
      return
    }
    if (!deliveryDate) {
      toast.error('Select the delivery date before saving this section')
      return
    }
    if (missingItems) {
      toast.error('Confirm all delivered items before saving this section')
      return
    }
    try {
      const payload: Record<string, string | boolean> = {
        'Vehicle Code': selectedVehicle.code,
        'Engine Number': selectedVehicle.engineNo,
        'Chassis Number': selectedVehicle.chassisNo,
        'Customer Name': selectedVehicle.customer?.name ?? '',
        'Delivery Date': deliveryDate,
        'Agreement Confirmation': agreementAccepted,
      }
      deliveredItems.forEach((item) => {
        payload[item] = deliveryItems[item]
      })
      if (workItem?.id) {
        await api.patch(`/work-items/${workItem.id}/payload`, payload)
      } else {
        await api.post('/modules/delivery/work-items', payload)
      }
      await load()
      const nextDraft: DeliveryDraft = {
        deliveryDate,
        deliveryItems,
        agreementAccepted,
        sectionSaved: { ...sectionSaved, items: true },
      }
      setSectionSaved(nextDraft.sectionSaved)
      saveDraftToStorage(nextDraft)
      toast.success('Section 01 saved and document uploads unlocked')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not save delivered items section')
    }
  }

  const saveAgreementSection = async () => {
    if (!sectionSaved.items) {
      toast.error('Save Section 01 first')
      return
    }
    if (!allDocsUploaded) {
      toast.error('Finish Section 02 document uploads before saving Section 03')
      return
    }
    if (!signature && !workPayload['Customer Signature']) {
      toast.error('Upload the customer signature first')
      return
    }
    if (!agreementAccepted) {
      toast.error('Accept the agreement checkbox first')
      return
    }
    if (!workItem?.id) {
      toast.error('Save Section 01 first to create the delivery record')
      return
    }
    try {
      await api.patch(`/work-items/${workItem.id}/payload`, {
        'Delivery Date': deliveryDate,
        'Customer Signature': signature?.fileName ?? String(workPayload['Customer Signature'] ?? ''),
        'Agreement Confirmation': agreementAccepted,
      })
      const nextDraft: DeliveryDraft = {
        deliveryDate,
        deliveryItems,
        agreementAccepted,
        sectionSaved: { ...sectionSaved, agreement: true },
      }
      setSectionSaved(nextDraft.sectionSaved)
      saveDraftToStorage(nextDraft)
      await load()
      toast.success('Section 03 saved')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not save agreement section')
    }
  }

  const setSignatureUpload = (file?: File) => {
    if (!file) return
    setSignature((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return {
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      }
    })
    toast.success(`${file.name} attached`)
  }

  const clearSignatureUpload = () => {
    setSignature((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }

  const viewLocalUpload = (upload: LocalUpload | null) => {
    if (!upload) return
    window.open(upload.previewUrl, '_blank', 'noopener,noreferrer')
  }

  const finalizeDelivery = async () => {
    if (!selectedVehicle) {
      toast.error('Select a vehicle first')
      return
    }
    if (!sectionSaved.items || !allDocsUploaded || !sectionSaved.agreement || !agreementAccepted) {
      toast.error('Finish all sections before finalizing the delivery receipt')
      return
    }
    if (!workItem?.id) {
      toast.error('Save Section 01 first')
      return
    }
    setLoading(true)
    try {
      await api.patch(`/work-items/${workItem.id}/payload`, {
        'Delivery Date': deliveryDate,
        'Customer Signature': signature?.fileName ?? String(workPayload['Customer Signature'] ?? ''),
        'Agreement Confirmation': agreementAccepted,
        'Delivery Finalized': true,
      })
      if (draftStorageKey) localStorage.removeItem(draftStorageKey)
      await load()
      setEditUnlocked(false)
      toast.success('Delivery receipt generated. This step is now locked in view mode.')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not finalize delivery sheet')
    } finally {
      setLoading(false)
    }
  }

  const uploadDocument = async (id: string, file?: File) => {
    if (!file) return
    await api.patch(`/documents/${id}/upload`, await fileToUploadPayload(file))
    await load()
    toast.success(`${file.name} uploaded`)
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

  const visibleDocuments = useMemo(() => {
    if (!workItem?.documents?.length) {
      return deliveryDocumentGuide.map((doc) => ({ ...doc, id: '', fileName: null as string | null, active: false }))
    }
    return deliveryDocumentGuide.map((doc) => {
      const liveDoc = workItem.documents.find((item) => item.name === doc.name)
      return {
        ...doc,
        id: liveDoc?.id ?? '',
        fileName: liveDoc?.fileName ?? null,
        active: Boolean(liveDoc),
      }
    })
  }, [workItem])

  const uploadedDocCount = useMemo(() => visibleDocuments.filter((document) => document.fileName).length, [visibleDocuments])
  const allDocsUploaded = uploadedDocCount === deliveryDocumentGuide.length

  const uploadAcceptForDocument = (name: string) => {
    if (name === 'Video Byte') return 'image/*,.png,.jpg,.jpeg,.webp,.mp4,.mov,video/mp4,video/quicktime'
    if (name === 'Tractor Invoice' || name === 'Quotation') return '.pdf,application/pdf'
    if (name === 'Customer Photo' || name === 'Delivery Photo') return 'image/*,.png,.jpg,.jpeg'
    return 'image/*,.png,.jpg,.jpeg,.pdf,application/pdf'
  }

  const signaturePreviewUrl = signature?.previewUrl ?? null
  const savedSignatureName = signature?.fileName ?? String(workPayload['Customer Signature'] ?? '')
  const canAccessSection2 = sectionSaved.items
  const canAccessSection3 = sectionSaved.items && allDocsUploaded

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-[110px]">
      <div className="mx-auto max-w-[1380px] px-8 py-8">
        {!pageReady ? (
          <section className="mb-6 rounded border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Loading delivery data...</section>
        ) : null}

        {loadIssue ? (
          <section className="mb-6 rounded border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-amber-900">Delivery Flow Note</p>
            <p className="mt-2 text-sm text-amber-800">{loadIssue}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => navigate('/installation')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open Installation
              </button>
              <button onClick={() => navigate('/guided-flow')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open Guided Flow
              </button>
            </div>
          </section>
        ) : null}

        <section className="mb-6 rounded border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1.1fr_1fr_1fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Name</p>
              <p className="mt-1 font-display text-[24px] font-semibold text-[#00450d]">{selectedVehicle?.customer?.name ?? 'Unassigned'}</p>
              <p className="mt-1 font-mono text-[12px] text-slate-500">UID: {selectedVehicle?.customer?.id ?? '--'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Vehicle Model</p>
              <p className="mt-1 font-display text-[24px] font-semibold text-slate-900">{selectedVehicle?.model ?? 'Select Vehicle'}</p>
              <p className="mt-1 font-mono text-[12px] text-slate-500">CHASSIS: {selectedVehicle?.chassisNo ?? '--'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Delivery Date</p>
              <input
                type="date"
                value={deliveryDate}
                disabled={!isEditing}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className="mt-2 h-11 w-full rounded border border-slate-200 px-3 font-mono text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <div className="flex flex-col justify-center">
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Select Vehicle</span>
                <select
                  value={selectedVehicleId}
                  disabled={!isEditing}
                  onChange={(event) => setSelectedVehicleId(event.target.value)}
                  className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.code} - {vehicle.model}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isFinalized ? 'bg-green-900 text-white' : 'bg-amber-100 text-amber-900'}`}>
                {isFinalized ? 'Delivery Step Finished' : 'Delivery In Progress'}
              </span>
              <span className="text-sm text-slate-600">
                {isFinalized ? 'This vehicle has completed the delivery stage. Open Edit only if corrections are required.' : 'Complete all three sections, then finalize to lock this stage.'}
              </span>
            </div>
            {isFinalized ? (
              <button
                type="button"
                onClick={() => setEditUnlocked((current) => !current)}
                className="rounded border border-[#1b5e20] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20]"
              >
                {isEditing ? 'Close Edit Mode' : 'Edit Delivery'}
              </button>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-[24px] font-semibold uppercase tracking-tight text-[#00450d]">Section 01: Delivered Items</h2>
                {sectionSaved.items ? <span className="rounded bg-[#1b5e20] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Saved</span> : null}
              </div>
              {isEditing ? (
                <button type="button" onClick={() => setDeliveryItems(Object.fromEntries(deliveredItems.map((item) => [item, true])))} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Select All Items
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {deliveredItems.map((item) => (
                <label key={item} className={`flex items-center gap-4 rounded border p-3 ${deliveryItems[item] ? 'border-[#d3ecd0] bg-[#f6fcf1]' : 'border-transparent bg-white'}`}>
                  <input
                    type="checkbox"
                    checked={deliveryItems[item]}
                    disabled={!isEditing}
                    onChange={(event) => setDeliveryItems((current) => ({ ...current, [item]: event.target.checked }))}
                    className="h-5 w-5 rounded-sm accent-[#1b5e20] disabled:opacity-100"
                  />
                  <div>
                    <p className="font-space-grotesk text-sm font-bold text-slate-900">{item}</p>
                    <p className="text-[11px] text-slate-500">Confirm physical handover to the customer.</p>
                  </div>
                </label>
              ))}
            </div>
            {isEditing ? (
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={saveDeliveredItemsSection} className="rounded border border-[#1b5e20] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20]">
                  Save Section 01
                </button>
              </div>
            ) : null}
          </section>

          <section className={`rounded border border-slate-200 bg-white p-6 shadow-sm ${canAccessSection2 || isFinalized ? '' : 'opacity-60'}`}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-[24px] font-semibold uppercase tracking-tight text-[#00450d]">Section 02: Document Uploads</h2>
                {allDocsUploaded ? <span className="rounded bg-[#1b5e20] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Saved</span> : null}
              </div>
              {!canAccessSection2 && !isFinalized ? <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Save Section 01 First</span> : null}
            </div>

            <div className="mb-5 rounded border border-[#acf4a4] bg-[#f3fbe9] p-4 text-sm text-slate-700">
              <p className="font-semibold text-[#00450d]">What to upload here</p>
              <p className="mt-2">
                Upload all 9 PRS-required delivery documents in this section. Once every document is uploaded, Section 03 unlocks. After finalization, this section switches to view mode unless you explicitly click Edit Delivery.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleDocuments.map((document) => (
                <div key={document.name} className={`rounded border p-4 ${document.fileName ? 'border-[#acf4a4] bg-[#f4fbf4]' : 'border-dashed border-slate-300 bg-white'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-sm ${document.fileName ? 'bg-[#1b5e20] text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <span className="material-symbols-outlined">{document.fileName ? 'description' : 'upload_file'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-space-grotesk text-sm font-bold text-slate-900">{document.name}</p>
                      <p className="text-[11px] text-slate-500">{document.fileName ?? `${document.formats} • ${document.size}`}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{document.note}</p>
                    </div>
                  </div>

                  {document.fileName ? (
                    isEditing ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <button onClick={() => viewDocument(document.id, document.fileName)} className="flex h-10 items-center justify-center gap-2 rounded border border-[#1b5e20] bg-white text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          View
                        </button>
                        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                          <span className="material-symbols-outlined text-[14px]">upload</span>
                          Re-upload
                          <input type="file" accept={uploadAcceptForDocument(document.name)} className="hidden" onChange={(event) => uploadDocument(document.id, event.target.files?.[0])} />
                        </label>
                        <button onClick={() => removeDocument(document.id)} className="flex h-10 items-center justify-center gap-2 rounded border border-red-200 bg-white text-[10px] font-bold uppercase tracking-wider text-red-700">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => viewDocument(document.id, document.fileName)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded border border-[#1b5e20] bg-white text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        View Document
                      </button>
                    )
                  ) : document.active && canAccessSection2 ? (
                    isEditing ? (
                      <label className="mt-4 flex h-10 cursor-pointer items-center justify-center gap-2 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                        <span className="material-symbols-outlined text-[14px]">upload</span>
                        Upload Document
                        <input type="file" accept={uploadAcceptForDocument(document.name)} className="hidden" onChange={(event) => uploadDocument(document.id, event.target.files?.[0])} />
                      </label>
                    ) : (
                      <div className="mt-4 flex h-10 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Document not uploaded
                      </div>
                    )
                  ) : (
                    <div className="mt-4 flex h-10 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Save Section 01 to unlock uploads
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className={`rounded border border-slate-200 bg-white p-6 shadow-sm ${canAccessSection3 || isFinalized ? '' : 'opacity-60'}`}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-[24px] font-semibold uppercase tracking-tight text-[#00450d]">Section 03: Agreement</h2>
                {sectionSaved.agreement ? <span className="rounded bg-[#1b5e20] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Saved</span> : null}
              </div>
              {!canAccessSection3 && !isFinalized ? <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Finish Section 02 First</span> : null}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Signature</p>
                <div className="flex h-[140px] flex-col justify-between rounded border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                  <div className="text-sm text-slate-600">
                    {savedSignatureName || 'Upload the customer signature image or signed capture file here.'}
                  </div>
                  {isEditing ? (
                    <div className="flex flex-wrap gap-3">
                      <label className="inline-flex cursor-pointer items-center justify-center rounded border border-[#1b5e20] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                        <input type="file" accept="image/*" className="hidden" onChange={(event) => setSignatureUpload(event.target.files?.[0])} />
                        {savedSignatureName ? 'Re-upload Signature' : 'Upload Signature'}
                      </label>
                      {savedSignatureName ? (
                        <>
                          {signature ? (
                            <button type="button" onClick={() => viewLocalUpload(signature)} className="rounded border border-slate-300 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                              View
                            </button>
                          ) : null}
                          <button type="button" onClick={clearSignatureUpload} className="rounded border border-red-300 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700">
                            Remove
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Signature Preview</p>
                <div className="flex h-[140px] items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                  {signaturePreviewUrl ? (
                    <img src={signaturePreviewUrl} alt="Customer signature preview" className="h-full w-full object-contain" />
                  ) : savedSignatureName ? (
                    <div className="px-5 text-center text-sm text-slate-500">{savedSignatureName}</div>
                  ) : (
                    <div className="text-sm italic text-slate-400">Signature required for submission</div>
                  )}
                </div>
              </div>
            </div>

            <label className="mt-6 flex items-start gap-4 rounded border border-[#acf4a4] bg-[#f3fbe9] p-4">
              <input
                type="checkbox"
                checked={agreementAccepted}
                disabled={!isEditing}
                onChange={(event) => setAgreementAccepted(event.target.checked)}
                className="mt-1 h-5 w-5 rounded-sm accent-[#1b5e20] disabled:opacity-100"
              />
              <div className="text-xs leading-relaxed text-slate-700">
                I confirm that the vehicle and the listed accessories were received in good condition, and the operations and safety maintenance schedules have been explained to me.
              </div>
            </label>

            {isEditing ? (
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={saveAgreementSection} disabled={!canAccessSection3} className="rounded border border-[#1b5e20] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">
                  Save Section 03
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <footer className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-6 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${sectionSaved.items ? 'bg-[#1b5e20]' : 'bg-red-500'}`} />
            {sectionSaved.items ? 'Section 01 saved' : 'Section 01 pending'}
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${allDocsUploaded ? 'bg-[#1b5e20]' : 'bg-amber-500'}`} />
            {allDocsUploaded ? 'Section 02 saved' : `${uploadedDocCount}/${deliveryDocumentGuide.length} documents uploaded`}
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${sectionSaved.agreement ? 'bg-[#1b5e20]' : 'bg-red-500'}`} />
            {sectionSaved.agreement ? 'Section 03 saved' : 'Section 03 pending'}
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isFinalized ? 'bg-[#1b5e20]' : 'bg-slate-300'}`} />
            {isFinalized ? 'Delivery finalized' : 'Finalize to lock this step'}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/installation')} className="rounded border-2 border-[#1b5e20] px-6 py-2.5 text-sm font-bold uppercase text-[#1b5e20]">Back</button>
          <button onClick={() => navigate(`/vehicle-flow/${selectedVehicleId}`)} disabled={!selectedVehicleId} className="rounded border border-slate-300 px-6 py-2.5 text-sm font-bold uppercase text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">
            Flow Tracker
          </button>
          <button onClick={() => navigate('/safety')} disabled={!isFinalized} className="rounded border border-slate-300 px-6 py-2.5 text-sm font-bold uppercase text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">
            Next Step
          </button>
          <button
            onClick={finalizeDelivery}
            disabled={loading || !selectedVehicle || !agreementAccepted || !sectionSaved.items || !sectionSaved.agreement || !allDocsUploaded || !isEditing}
            className="rounded bg-[#1b5e20] px-10 py-2.5 text-sm font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? 'Saving...' : isFinalized && !isEditing ? 'Receipt Locked' : 'Finalize & Generate Receipt'}
          </button>
        </div>
      </footer>
    </div>
  )
}
