import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { WorkItem } from '../data/dmsData'
import DataTable from '../components/ui/DataTable'
import KpiCard from '../components/ui/KpiCard'
import PageHeader from '../components/ui/PageHeader'
import StatusPill from '../components/ui/StatusPill'
import { fileToUploadPayload } from '../lib/upload'

const mobilePattern = /^\d{10}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const flowOrder = ['purchase', 'installation', 'pdi', 'delivery', 'safety', 'rto', 'insurance', 'accounts', 'ats', 'service', 'exchange']

function isDateField(field: string) {
  return /date|deadline/i.test(field)
}

function isMobileField(field: string) {
  return /mobile/i.test(field)
}

function isEmailField(field: string) {
  return /email/i.test(field)
}

function isNumericField(field: string) {
  return /mobile|aadhaar|number of vehicles|amount|value|year|hours|receipt|discount|charges|balance|disbursal|booking/i.test(field)
}

function sanitizeFieldValue(field: string, value: string) {
  if (isMobileField(field) || /aadhaar/i.test(field)) {
    return value.replace(/\D/g, '')
  }
  if (/number of vehicles|year|hours/i.test(field)) {
    return value.replace(/\D/g, '')
  }
  if (/amount|value|balance|disbursal|booking|discount|charges/i.test(field)) {
    return value.replace(/[^\d.]/g, '')
  }
  return value
}

function validateContactFields(values: Record<string, string>) {
  for (const [field, value] of Object.entries(values)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (isMobileField(field) && !mobilePattern.test(trimmed)) {
      return `${field} must be exactly 10 digits`
    }
    if (isEmailField(field) && !emailPattern.test(trimmed)) {
      return `${field} must be a valid email address`
    }
  }
  return ''
}

export default function ModulePage({ moduleKey }: { moduleKey: string }) {
  const navigate = useNavigate()
  const [config, setConfig] = useState<any>(null)
  const [rows, setRows] = useState<WorkItem[]>([])
  const [documents, setDocuments] = useState<{ id: string; name: string; status: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  const normalizedRows = useMemo(() => rows.map((row: any) => ({
    id: row.id,
    ref: row.ref,
    customer: row.customer?.name ?? '',
    vehicle: row.vehicle?.model ?? '',
    owner: row.owner?.name ?? '',
    status: row.status,
    due: row.due,
    amount: typeof row.amount === 'number' ? `Rs.${row.amount.toLocaleString('en-IN')}` : row.amount,
  })), [rows])

  const fields = Array.isArray(config?.fields) ? config.fields : []
  const nextModuleKey = flowOrder[flowOrder.indexOf(moduleKey) + 1]
  const liveKpis = useMemo(() => {
    const openRows = rows.filter((row: any) => row.status !== 'Complete')
    const pendingDocuments = rows.reduce((sum: number, row: any) => sum + (row.documents ?? []).filter((doc: any) => doc.status !== 'Uploaded').length, 0)
    const totalAmount = rows.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0)
    return [
      { label: 'DB records', value: String(rows.length).padStart(2, '0'), helper: 'WorkItem rows from database', tone: 'info' as const },
      { label: 'Open items', value: String(openRows.length).padStart(2, '0'), helper: 'Non-complete DB statuses', tone: openRows.length ? 'warning' as const : 'success' as const },
      { label: 'Document holds', value: String(pendingDocuments).padStart(2, '0'), helper: `Rs.${totalAmount.toLocaleString('en-IN')} total value`, tone: pendingDocuments ? 'danger' as const : 'success' as const },
    ]
  }, [rows])

  const loadRows = async () => {
    const { data } = await api.get(`/modules/${moduleKey}/work-items`)
    setRows(data)
    setDocuments(data[0]?.documents ?? [])
  }

  useEffect(() => {
    Promise.all([api.get(`/modules/${moduleKey}`), api.get(`/modules/${moduleKey}/work-items`)])
      .then(([moduleResponse, rowsResponse]) => {
        setConfig(moduleResponse.data)
        setRows(rowsResponse.data)
        setDocuments(rowsResponse.data[0]?.documents ?? [])
      })
      .catch(() => toast.error('Could not load live module data from backend'))
  }, [moduleKey])

  const createWorkItem = async () => {
    const validationError = validateContactFields(formValues)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setLoading(true)
    try {
      await api.post(`/modules/${moduleKey}/work-items`, {
        action: config.primaryAction,
        ...formValues,
        createCustomer: moduleKey === 'installation',
        createVehicle: moduleKey === 'purchase',
      })
      setFormValues({})
      await loadRows()
      toast.success(`${config.title} record created in DB`)
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not create record')
    } finally {
      setLoading(false)
    }
  }

  const completeWorkItem = async (id: string) => {
    await api.patch(`/work-items/${id}/status`, { status: 'Complete' })
    await loadRows()
    toast.success('Work item marked complete')
  }

  const toggleDocument = async (id: string) => {
    await api.patch(`/documents/${id}/toggle`)
    await loadRows()
    toast.success('Document status updated')
  }

  const uploadDocument = async (id: string, file?: File) => {
    if (!file) return
    await api.patch(`/documents/${id}/upload`, await fileToUploadPayload(file))
    await loadRows()
    toast.success(`${file.name} uploaded`)
  }

  const viewDocument = async (id: string, fileName?: string | null) => {
    if (!fileName) return
    const { data } = await api.get(`/documents/${id}/file`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const sendOtp = async () => {
    const mobile = formValues['Mobile Number'] || formValues.mobile
    if (!mobile) {
      toast.error('Enter Mobile Number first')
      return
    }
    if (!mobilePattern.test(mobile.trim())) {
      toast.error('Mobile Number must be exactly 10 digits')
      return
    }
    const { data } = await api.post('/otp/send', { mobile, context: moduleKey })
    toast.success(`OTP generated: ${data.demoOtp}`)
  }

  const verifyOtp = async () => {
    const mobile = formValues['Mobile Number'] || formValues.mobile
    const otp = formValues['Inspector OTP'] || formValues['OTP Verification'] || formValues.otp
    if (!mobile || !otp) {
      toast.error('Enter Mobile Number and OTP first')
      return
    }
    if (!mobilePattern.test(mobile.trim())) {
      toast.error('Mobile Number must be exactly 10 digits')
      return
    }
    const { data } = await api.post('/otp/verify', { mobile, otp, context: moduleKey })
    toast.success(data.verified ? 'OTP verified and logged' : 'OTP failed')
  }

  const goToNextStep = () => {
    if (!nextModuleKey) return
    navigate(`/${nextModuleKey}`)
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="rounded border border-outline-variant bg-white p-5 text-sm text-on-surface-variant">Loading live database module data...</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader icon={config.icon} title={config.title} subtitle={config.subtitle} action={config.primaryAction} onAction={createWorkItem} />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {liveKpis.map((item) => <KpiCard key={item.label} item={item} />)}
        </div>

        <div className="grid gap-6">
          <section className="rounded border border-outline-variant bg-white">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">{config.prs}</p>
                <h2 className="font-display text-xl font-semibold text-green-950">Operational Entry Form</h2>
              </div>
              <StatusPill tone="success">Next: {config.statusAfter}</StatusPill>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {fields.map((field: string) => (
                <label key={field} className={field.toLowerCase().includes('remarks') || field.toLowerCase().includes('address') ? 'md:col-span-2' : ''}>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">{field}</span>
                  {field.toLowerCase().includes('remarks') || field.toLowerCase().includes('address') ? (
                    <textarea value={formValues[field] ?? ''} onChange={(event) => setFormValues((current) => ({ ...current, [field]: event.target.value }))} className="h-24 w-full rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-green-900" placeholder={`Enter ${field}`} />
                  ) : (
                    <input
                      type={isDateField(field) ? 'date' : isEmailField(field) ? 'email' : isNumericField(field) ? 'text' : 'text'}
                      inputMode={isNumericField(field) ? 'numeric' : undefined}
                      pattern={isMobileField(field) ? '\\d{10}' : isNumericField(field) ? '[0-9.]*' : undefined}
                      value={formValues[field] ?? ''}
                      onChange={(event) => setFormValues((current) => ({ ...current, [field]: sanitizeFieldValue(field, event.target.value) }))}
                      className="h-10 w-full rounded border border-outline-variant bg-white px-3 text-sm outline-none focus:border-green-900"
                      placeholder={isDateField(field) ? undefined : `Enter ${field}`}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        </div>

        {documents.length ? (
          <section className="rounded border border-outline-variant bg-white">
            <div className="border-b border-outline-variant px-5 py-4">
              <h2 className="font-display text-xl font-semibold text-green-950">Documents</h2>
              <p className="text-xs text-on-surface-variant">Upload and review the live document rows created for this record.</p>
            </div>
            <div className="space-y-2 p-5">
              {documents.map((doc: any) => (
                <div key={doc.id} className="rounded border border-outline-variant px-3 py-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{doc.name}</p>
                      <p className="text-xs text-on-surface-variant">{doc.fileName || 'No file selected'}</p>
                    </div>
                    <StatusPill tone={doc.status === 'Uploaded' ? 'success' : 'warning'}>{doc.status}</StatusPill>
                  </div>
                  {doc.fileName ? (
                    <button onClick={() => viewDocument(doc.id, doc.fileName)} className="rounded border border-green-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-green-950">
                      View
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        onChange={(event) => uploadDocument(doc.id, event.target.files?.[0])}
                        className="block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-green-900 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wider file:text-white"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-green-950">Live Work Queue</h2>
          <button onClick={createWorkItem} className="inline-flex items-center gap-2 rounded border border-green-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-green-950">
              <span className="material-symbols-outlined text-base">add</span>
              New DB Record
            </button>
          </div>
          <DataTable rows={normalizedRows} onComplete={completeWorkItem} />
        </section>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-outline-variant bg-white/95 px-5 py-3 backdrop-blur">
          {nextModuleKey ? (
            <button onClick={goToNextStep} disabled={!rows.length} className="rounded border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
              Next Step
            </button>
          ) : null}
          <button onClick={sendOtp} className="rounded border border-green-900 px-4 py-2 text-sm font-bold uppercase tracking-wider text-green-950">Send OTP</button>
          <button onClick={verifyOtp} className="rounded border border-green-900 px-4 py-2 text-sm font-bold uppercase tracking-wider text-green-950">Verify OTP</button>
          <button onClick={createWorkItem} disabled={loading} className="rounded bg-green-900 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">{loading ? 'Saving...' : config.primaryAction}</button>
        </div>
      </div>
    </div>
  )
}
