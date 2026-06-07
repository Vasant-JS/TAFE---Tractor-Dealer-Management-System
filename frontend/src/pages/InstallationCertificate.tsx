import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type Vehicle = {
  id: string
  code: string
  engineNo: string
  chassisNo: string
  model: string
  status: string
  customerId?: string | null
}

type Customer = {
  id: string
  name: string
  mobile: string
  email?: string | null
  address: string
  aadhaar?: string | null
  panNumber?: string | null
}

type LocalUpload = {
  fileName: string
  previewUrl: string
}

const mobilePattern = /^\d{10}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const aadhaarPattern = /^\d{12}$/
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const initialForm = {
  'Dealer Code': '',
  'OSM Number': '',
  'Dealer Name': '',
  'Dealer City': '',
  'Tractor Number': '',
  'Engine Number': '',
  'Installation Date': '',
  'TAFE Invoice Number': '',
  'TAFE Invoice Date': '',
  'Customer Name': '',
  'Customer First Name': '',
  'Customer Second Name': '',
  'Customer Last Name': '',
  'Father Name': '',
  'Mobile Number': '',
  'Email Address': '',
  'Aadhaar Number': '',
  'PAN Number': '',
  'Door Number': '',
  'Street Number': '',
  'Village Name': '',
  'PO Name': '',
  'PIN Code': '',
  Taluk: '',
  District: '',
  State: '',
  Address: '',
  'Customer Satisfaction Confirmation': '',
  'Dealer Installation Confirmation': '',
  'Digital Signature': '',
  'Dealer Stamp and Signature': '',
  'Dealer Signature Date': '',
}

const dealerFields = [
  { key: 'Dealer Code', label: 'Dealer Code' },
  { key: 'OSM Number', label: 'OSM No.' },
  { key: 'Dealer Name', label: 'Dealer Name' },
  { key: 'Dealer City', label: 'Dealer City' },
] as const

const tractorFields = [
  { key: 'Tractor Number', label: 'Tractor No.' },
  { key: 'Engine Number', label: 'Engine No.' },
  { key: 'Installation Date', label: 'Installation Date', type: 'date' },
  { key: 'TAFE Invoice Number', label: 'TAFE Invoice No.' },
  { key: 'TAFE Invoice Date', label: 'Invoice Date', type: 'date' },
] as const

const addressFields = [
  { key: 'Door Number', label: 'Door No.' },
  { key: 'Street Number', label: 'Street No.' },
  { key: 'Village Name', label: 'Village Name' },
  { key: 'PO Name', label: 'P.O. Name' },
  { key: 'PIN Code', label: 'PIN Code' },
  { key: 'Taluk', label: 'Taluk' },
  { key: 'District', label: 'District' },
  { key: 'State', label: 'State' },
] as const

export default function InstallationCertificate() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [search, setSearch] = useState('')
  const [formValues, setFormValues] = useState(initialForm)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [customerSignature, setCustomerSignature] = useState<LocalUpload | null>(null)
  const [handoverPhoto, setHandoverPhoto] = useState<LocalUpload | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [loadIssue, setLoadIssue] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof typeof initialForm, string>>>({})

  const load = async () => {
    const [vehicleRes, customerRes] = await Promise.allSettled([api.get('/vehicles'), api.get('/customers')])
    const vehicleRows = vehicleRes.status === 'fulfilled' ? vehicleRes.value.data : []
    const customerRows = customerRes.status === 'fulfilled' ? customerRes.value.data : []
      const readyVehicles = vehicleRows.filter((vehicle: Vehicle) => ['Pending Installation', 'Ready for Installation'].includes(vehicle.status))
    setVehicles(readyVehicles)
    setCustomers(customerRows)
    if (!selectedVehicleId && readyVehicles[0]?.id) setSelectedVehicleId(readyVehicles[0].id)
    if (vehicleRes.status === 'rejected' && customerRes.status === 'rejected') {
      setLoadIssue('Installation data is temporarily unavailable. Refresh once the backend is up.')
    } else if (!readyVehicles.length) {
        setLoadIssue('No vehicle is ready for installation yet. Complete Purchase Invoice and PDI for that vehicle first.')
    } else {
      setLoadIssue('')
    }
    setPageReady(true)
  }

  useEffect(() => {
    load().catch(() => {
      setLoadIssue('Installation data is temporarily unavailable. Refresh once the backend is up.')
      setPageReady(true)
    })
  }, [])

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return customers.slice(0, 5)
    return customers.filter((customer) =>
      [customer.name, customer.mobile, customer.aadhaar ?? ''].some((value) => value.toLowerCase().includes(term)),
    ).slice(0, 5)
  }, [customers, search])

  const selectCustomer = (customer: Customer) => {
    setErrors({})
    clearUpload(setCustomerSignature)
    clearUpload(setHandoverPhoto)
    setFormValues({
      'Customer Name': customer.name,
      'Father Name': '',
      'Mobile Number': customer.mobile,
      'Email Address': customer.email ?? '',
      'Aadhaar Number': customer.aadhaar ?? '',
      'PAN Number': customer.panNumber ?? '',
      'Dealer Code': '',
      'OSM Number': '',
      'Dealer Name': '',
      'Dealer City': '',
      'Tractor Number': '',
      'Engine Number': '',
      'Installation Date': '',
      'TAFE Invoice Number': '',
      'TAFE Invoice Date': '',
      'Customer First Name': customer.name.split(' ')[0] ?? '',
      'Customer Second Name': customer.name.split(' ').slice(1, -1).join(' '),
      'Customer Last Name': customer.name.split(' ').slice(-1)[0] ?? '',
      'Door Number': '',
      'Street Number': '',
      'Village Name': '',
      'PO Name': '',
      'PIN Code': '',
      Taluk: '',
      District: '',
      State: '',
      Address: customer.address,
      'Customer Satisfaction Confirmation': '',
      'Dealer Installation Confirmation': '',
      'Digital Signature': '',
      'Dealer Stamp and Signature': '',
      'Dealer Signature Date': '',
    })
  }

  const clearUpload = (setter: Dispatch<SetStateAction<LocalUpload | null>>) => {
    setter((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }

  const setUpload = (file: File | undefined, setter: Dispatch<SetStateAction<LocalUpload | null>>, successLabel: string) => {
    if (!file) return
    setter((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return {
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      }
    })
    toast.success(`${successLabel} attached`)
  }

  const viewUpload = (upload: LocalUpload | null) => {
    if (!upload) return
    window.open(upload.previewUrl, '_blank', 'noopener,noreferrer')
  }

  const renderField = (field: { key: keyof typeof initialForm; label: string; type?: string }) => (
    <label key={field.key} className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{field.label}</span>
      <input
        type={field.type ?? 'text'}
        value={formValues[field.key]}
        onChange={(event) => updateField(field.key, event.target.value)}
        className="h-10 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]"
      />
    </label>
  )

  const resetForNewCustomer = () => {
    setSearch('')
    setErrors({})
    setOtp('')
    setOtpSent(false)
    clearUpload(setCustomerSignature)
    clearUpload(setHandoverPhoto)
    setFormValues(initialForm)
  }

  const validateField = (field: keyof typeof initialForm, value: string) => {
    const trimmed = value.trim()
    if (field === 'Mobile Number' && trimmed && !mobilePattern.test(trimmed)) {
      return 'Mobile number must be exactly 10 digits'
    }
    if (field === 'Email Address' && trimmed && !emailPattern.test(trimmed)) {
      return 'Enter a valid email address'
    }
    if (field === 'Aadhaar Number' && trimmed && !aadhaarPattern.test(trimmed)) {
      return 'Aadhaar number must be exactly 12 digits'
    }
    if (field === 'PAN Number' && trimmed && !panPattern.test(trimmed)) {
      return 'PAN must be in format AAAAA9999A'
    }
    return ''
  }

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof typeof initialForm, string>> = {}
    ;(Object.keys(formValues) as Array<keyof typeof initialForm>).forEach((field) => {
      const message = validateField(field, formValues[field])
      if (message) nextErrors[field] = message
    })
    setErrors(nextErrors)
    return nextErrors
  }

  const updateField = (field: keyof typeof initialForm, value: string) => {
    let nextValue = value
    if (field === 'Mobile Number' || field === 'Aadhaar Number' || field === 'PIN Code') nextValue = value.replace(/\D/g, '')
    if (field === 'Aadhaar Number') nextValue = nextValue.slice(0, 12)
    if (field === 'Mobile Number') nextValue = nextValue.slice(0, 10)
    if (field === 'PIN Code') nextValue = nextValue.slice(0, 6)
    if (field === 'PAN Number') nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    setFormValues((current) => ({ ...current, [field]: nextValue }))
    setErrors((current) => ({ ...current, [field]: validateField(field, nextValue) || undefined }))
  }

  const sendOtp = async () => {
    const mobileError = validateField('Mobile Number', formValues['Mobile Number'])
    if (mobileError) {
      setErrors((current) => ({ ...current, 'Mobile Number': mobileError }))
      toast.error(mobileError)
      return
    }
    await api.post('/otp/send', { mobile: formValues['Mobile Number'], context: `installation:${selectedVehicle?.code ?? 'pending'}` })
    setOtpSent(true)
    toast.success('Customer OTP sent')
  }

  const submitCertificate = async () => {
    if (!selectedVehicle) {
      toast.error('Select a vehicle first')
      return
    }
    const validationErrors = validateForm()
    const composedAddress = [
      formValues['Door Number'],
      formValues['Street Number'],
      formValues['Village Name'],
      formValues['PO Name'],
      formValues.Taluk,
      formValues.District,
      formValues.State,
      formValues['PIN Code'] ? `PIN ${formValues['PIN Code']}` : '',
    ].filter(Boolean).join(', ')
    if (!formValues['Customer Name'] || formValues['Mobile Number'].length !== 10 || (!formValues.Address && !composedAddress)) {
      toast.error('Enter customer name, phone number, and address')
      return
    }
    if (Object.keys(validationErrors).length) {
      toast.error('Fix the highlighted validation errors first')
      return
    }
    if (!customerSignature) {
      toast.error('Customer confirmation signature is required by PRS before generating the certificate')
      return
    }
    setLoading(true)
    try {
      await api.post('/modules/installation/work-items', {
        ...formValues,
        Address: formValues.Address || composedAddress,
        'Vehicle Code': selectedVehicle.code,
        'Tractor Number': formValues['Tractor Number'] || selectedVehicle.chassisNo,
        'Engine Number': selectedVehicle.engineNo,
        'Chassis Number': selectedVehicle.chassisNo,
        'Digital Signature': customerSignature.fileName,
        'Handover Photo': handoverPhoto?.fileName ?? '',
        'OTP Verified': otp.length === 6 ? 'true' : '',
      })
      toast.success('Installation certificate generated')
      navigate('/delivery')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not create installation certificate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-28">
      <div className="mx-auto max-w-[1380px] px-8 py-8">
        {!pageReady ? (
          <section className="mb-6 rounded border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Loading installation data...</section>
        ) : null}
        {loadIssue ? (
          <section className="mb-6 rounded border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-amber-900">Installation Flow Note</p>
            <p className="mt-2 text-sm text-amber-800">{loadIssue}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => navigate('/purchase-invoices')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open Purchase Invoices
              </button>
              <button onClick={() => navigate('/pdi')} className="rounded border border-amber-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Open PDI
              </button>
            </div>
          </section>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-[1.08fr_1.22fr]">
          <section className="rounded border border-slate-200 bg-white shadow-sm">
            <div className="border-l-4 border-[#1b5e20] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-[22px] font-semibold text-[#00450d]">Vehicle Profile</h2>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Read-only Technical Data</p>
                </div>
                <span className="rounded-full bg-[#2e7d32] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  {selectedVehicle?.status ?? 'Awaiting Selection'}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Dealer / OSM Details</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {dealerFields.map(renderField)}
                  </div>
                </div>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Select Vehicle</span>
                  <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]">
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.code} - {vehicle.model}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
                    {tractorFields.map((field) =>
                      field.key === 'Engine Number'
                        ? renderField({ ...field, key: 'Engine Number' })
                        : renderField(field),
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Engine Number</p>
                    <p className="mt-1 font-mono text-[13px] text-slate-900">{selectedVehicle?.engineNo ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Chassis Number</p>
                    <p className="mt-1 font-mono text-[13px] text-slate-900">{selectedVehicle?.chassisNo ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Model / Variant</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedVehicle?.model ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Workflow Status</p>
                    <p className="mt-1 text-sm text-slate-900">{selectedVehicle?.status ?? '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded border border-slate-200 bg-white shadow-sm">
            <div className="border-l-4 border-[#1b5e20] p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="font-display text-[22px] font-semibold text-[#00450d]">Customer Assignment</h2>
                <button type="button" onClick={resetForNewCustomer} className="rounded border border-[#1b5e20] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                  Add Customer
                </button>
              </div>

              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Search Registered Customer</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" placeholder="Mobile, Name or Aadhaar..." />
                </label>

                {filteredCustomers.length ? (
                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="space-y-2">
                      {filteredCustomers.map((customer) => (
                        <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className="flex w-full items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-[#1b5e20]">
                          <span>{customer.name}</span>
                          <span className="font-mono text-[12px] text-slate-500">{customer.mobile}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer's Full Name</span>
                    <input value={formValues['Customer Name']} onChange={(event) => updateField('Customer Name', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">First</span>
                    <input value={formValues['Customer First Name']} onChange={(event) => updateField('Customer First Name', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Second</span>
                    <input value={formValues['Customer Second Name']} onChange={(event) => updateField('Customer Second Name', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Last</span>
                    <input value={formValues['Customer Last Name']} onChange={(event) => updateField('Customer Last Name', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Father Name</span>
                    <input value={formValues['Father Name']} onChange={(event) => updateField('Father Name', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Phone No.</span>
                    <input value={formValues['Mobile Number']} onChange={(event) => updateField('Mobile Number', event.target.value)} className={`h-11 w-full rounded border px-3 font-mono text-sm outline-none focus:border-[#1b5e20] ${errors['Mobile Number'] ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
                    {errors['Mobile Number'] ? <p className="text-xs text-red-600">{errors['Mobile Number']}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Email Address</span>
                    <input type="email" value={formValues['Email Address']} onChange={(event) => updateField('Email Address', event.target.value)} className={`h-11 w-full rounded border px-3 text-sm outline-none focus:border-[#1b5e20] ${errors['Email Address'] ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
                    {errors['Email Address'] ? <p className="text-xs text-red-600">{errors['Email Address']}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Aadhaar Number</span>
                    <input value={formValues['Aadhaar Number']} onChange={(event) => updateField('Aadhaar Number', event.target.value)} className={`h-11 w-full rounded border px-3 font-mono text-sm outline-none focus:border-[#1b5e20] ${errors['Aadhaar Number'] ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
                    {errors['Aadhaar Number'] ? <p className="text-xs text-red-600">{errors['Aadhaar Number']}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">PAN Number</span>
                    <input value={formValues['PAN Number']} onChange={(event) => updateField('PAN Number', event.target.value)} className={`h-11 w-full rounded border px-3 font-mono text-sm uppercase outline-none focus:border-[#1b5e20] ${errors['PAN Number'] ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
                    {errors['PAN Number'] ? <p className="text-xs text-red-600">{errors['PAN Number']}</p> : null}
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {addressFields.map(renderField)}
                </div>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Full Address</span>
                  <textarea value={formValues.Address} onChange={(event) => updateField('Address', event.target.value)} rows={3} className="w-full rounded border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#1b5e20]" />
                </label>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
          <section className="rounded border border-slate-200 bg-[#f2f5ec] p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#1b5e20]">vibration</span>
              <h3 className="font-display text-[20px] font-semibold text-slate-900">Verification</h3>
            </div>
            <p className="mt-4 text-sm text-slate-600">Send a 6-digit OTP to the registered mobile before generating the certificate.</p>
            <div className="mt-5 space-y-4">
              <button type="button" onClick={sendOtp} className="w-full rounded bg-slate-900 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white">
                {otpSent ? 'Resend OTP' : 'Send OTP'}
              </button>
              <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-12 w-full rounded border border-slate-300 px-3 text-center font-mono text-xl outline-none focus:border-[#1b5e20]" placeholder="000000" />
            </div>
          </section>

          <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#8f4e00]">draw</span>
                <h3 className="font-display text-[20px] font-semibold text-slate-900">Customer Confirmation</h3>
              </div>
            </div>
            <div className="rounded border-2 border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="mb-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Satisfaction Statement</span>
                  <textarea
                    value={formValues['Customer Satisfaction Confirmation']}
                    onChange={(event) => updateField('Customer Satisfaction Confirmation', event.target.value)}
                    rows={3}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1b5e20]"
                    placeholder="The Tractor has been installed to my satisfaction"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Dealer Installation Statement</span>
                  <textarea
                    value={formValues['Dealer Installation Confirmation']}
                    onChange={(event) => updateField('Dealer Installation Confirmation', event.target.value)}
                    rows={3}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1b5e20]"
                    placeholder="The Tractor has been installed to satisfaction of the customer"
                  />
                </label>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Confirmation Signature</p>
              <p className="mt-2 text-sm text-slate-600">PRS requires a digital signature for Installation Certificate generation.</p>
              <div className="mt-4 rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                {customerSignature?.fileName ?? 'No signature uploaded yet'}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded border border-[#1b5e20] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                  <input type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.pdf" className="hidden" onChange={(event) => setUpload(event.target.files?.[0], setCustomerSignature, 'Signature file')} />
                  {customerSignature ? 'Re-upload Signature' : 'Upload Signature'}
                </label>
                {customerSignature ? (
                  <>
                    <button type="button" onClick={() => viewUpload(customerSignature)} className="rounded border border-slate-300 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      View
                    </button>
                    <button type="button" onClick={() => clearUpload(setCustomerSignature)} className="rounded border border-red-300 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700">
                      Remove
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Dealer Stamp and Signature</p>
              <p className="mt-2 text-sm text-slate-600">Attach dealer stamp/signature evidence and signature date from the certificate.</p>
              <label className="mt-4 block space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Date</span>
                <input type="date" value={formValues['Dealer Signature Date']} onChange={(event) => updateField('Dealer Signature Date', event.target.value)} className="h-10 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20]" />
              </label>
              <div className="mt-4 rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                {handoverPhoto?.fileName ?? 'No handover photo uploaded yet'}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded border border-[#1b5e20] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1b5e20]">
                  <input type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.pdf" className="hidden" onChange={(event) => setUpload(event.target.files?.[0], setHandoverPhoto, 'Handover file')} />
                  {handoverPhoto ? 'Re-upload Photo' : 'Upload Photo'}
                </label>
                {handoverPhoto ? (
                  <>
                    <button type="button" onClick={() => viewUpload(handoverPhoto)} className="rounded border border-slate-300 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      View
                    </button>
                    <button type="button" onClick={() => clearUpload(setHandoverPhoto)} className="rounded border border-red-300 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700">
                      Remove
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex gap-4">
          <button onClick={() => navigate('/pdi')} className="rounded border border-slate-300 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-700">Back</button>
          <button onClick={() => navigate('/delivery')} className="rounded border border-slate-300 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-700">Next Step</button>
        </div>
        <button onClick={submitCertificate} disabled={loading || !selectedVehicle} className="rounded bg-[#1b5e20] px-8 py-3 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
          {loading ? 'Generating...' : 'Generate & Allocate'}
        </button>
      </footer>
    </div>
  )
}
