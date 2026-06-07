import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'

type Vehicle = {
  id: string
  code: string
  model: string
  chassisNo: string
  status: string
  customer?: { name: string; mobile: string; address: string } | null
}

type Row = {
  id: string
  status: string
  payload?: string | null
  vehicle?: Vehicle | null
  customer?: { name: string; mobile: string; address?: string } | null
}

const topics = [
  'PTO safety and rotating parts awareness',
  'Hydraulic system handling and lockout',
  'Daily engine oil and coolant inspection',
  'Tyre pressure and wheel nut inspection',
  'Genuine spare parts and warranty validity',
  'Service interval planning and escalation path',
]

function parsePayload(payload?: string | null) {
  try {
    return payload ? JSON.parse(payload) : {}
  } catch {
    return {}
  }
}

export default function SafetyMaintenance() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [language, setLanguage] = useState('English')
  const [acknowledged, setAcknowledged] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [dosDontsViewed, setDosDontsViewed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editUnlocked, setEditUnlocked] = useState(false)

  const load = async () => {
    const [vehicleRes, rowRes] = await Promise.all([api.get('/vehicles'), api.get('/modules/safety/work-items')])
    const eligible = vehicleRes.data.filter((vehicle: Vehicle) => ['Delivered', 'Allocated to Customer', 'Safety Acknowledged', 'Insured', 'RTO Verification In Progress', 'RTO Filed', 'Financially Closed', 'Closed'].includes(vehicle.status))
    setVehicles(eligible)
    setRows(rowRes.data)
    if (requestedVehicleId && eligible.some((vehicle: Vehicle) => vehicle.id === requestedVehicleId)) {
      setSelectedVehicleId(requestedVehicleId)
    } else if (eligible[0]) {
      setSelectedVehicleId((current) => current || eligible[0].id)
    }
  }

  useEffect(() => {
    load().catch(() => toast.error('Could not load safety records'))
  }, [requestedVehicleId])

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId])
  const currentRow = useMemo(() => rows.find((row) => row.vehicle?.id === selectedVehicleId) ?? null, [rows, selectedVehicleId])
  const payload = useMemo(() => parsePayload(currentRow?.payload), [currentRow])
  const isFinalized = Boolean(currentRow)
  const isEditing = !isFinalized || editUnlocked

  useEffect(() => {
    const alreadyVerified = Boolean(payload['OTP Verification']) || Boolean(currentRow)
    setEditUnlocked(false)
    setLanguage(String(payload['Language Preference'] ?? 'English'))
    setAcknowledged(Boolean(payload['Acknowledged']) || alreadyVerified)
    setOtp(alreadyVerified ? '123456' : '')
    setOtpSent(alreadyVerified)
    setDosDontsViewed(alreadyVerified)
  }, [payload, currentRow, selectedVehicleId])

  const sendOtp = async () => {
    if (!dosDontsViewed) {
      toast.error("View Do's & Don'ts before sending OTP")
      return
    }
    if (!selectedVehicle?.customer?.mobile) {
      toast.error('Customer mobile is required before OTP verification')
      return
    }
    await api.post('/otp/send', { mobile: selectedVehicle.customer.mobile, context: `safety:${selectedVehicle.code}` })
    setOtpSent(true)
    toast.success('Safety acknowledgement OTP sent')
  }

  const finalize = async () => {
    if (!selectedVehicle) {
      toast.error('Select a customer vehicle first')
      return
    }
    if (!acknowledged) {
      toast.error('Customer acknowledgement is required')
      return
    }
    setLoading(true)
    try {
      const nextPayload = {
        'Vehicle Code': selectedVehicle.code,
        'Customer Name': selectedVehicle.customer?.name ?? '',
        'Mobile Number': selectedVehicle.customer?.mobile ?? '',
        'Language Preference': language,
        Acknowledged: acknowledged,
        'OTP Verification': otp.length === 6 ? 'true' : '',
      }
      if (currentRow?.id) {
        await api.patch(`/work-items/${currentRow.id}/payload`, nextPayload)
      } else {
        await api.post('/modules/safety/work-items', nextPayload)
      }
      await load()
      setEditUnlocked(false)
      toast.success('Safety handover recorded and locked')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not complete safety handover')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-24">
      <div className="mx-auto max-w-[1360px] px-8 py-8 space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-[32px] font-bold text-[#00450d]">Safety & Maintenance</h1>
            <p className="mt-1 text-sm italic text-slate-500">Operator awareness and equipment briefing workflow</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.open('/safety/maintenance-guide', '_blank', 'noopener,noreferrer')}
              className="rounded border border-[#1b5e20] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20]"
            >
              Open Maintenance Document
            </button>
            <span className={`rounded px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${isFinalized ? 'bg-[#1b5e20] text-white' : 'bg-amber-100 text-amber-900'}`}>
              {isFinalized ? 'Safety Step Finished' : 'Safety In Progress'}
            </span>
            {isFinalized ? (
              <button onClick={() => setEditUnlocked((value) => !value)} className="rounded border border-[#1b5e20] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1b5e20]">
                {isEditing ? 'Close Edit' : 'Edit Safety'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-4 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-l-4 border-[#1b5e20] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Identified Unit</span>
                <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${isFinalized ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isFinalized ? 'Locked' : 'Open'}
                </span>
              </div>
              <label className="space-y-2 block">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Customer Vehicle</span>
                <select
                  value={selectedVehicleId}
                  disabled={!isEditing}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.model} - {vehicle.code}</option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Model</p>
                <p className="mt-1 font-display text-[22px] font-semibold text-[#00450d]">{selectedVehicle?.model ?? '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Chassis No.</p>
                  <p className="mt-1 font-mono text-[12px]">{selectedVehicle?.chassisNo ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Owner</p>
                  <p className="mt-1">{selectedVehicle?.customer?.name ?? 'Unassigned'}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="col-span-12 lg:col-span-8 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-l-4 border-[#1b5e20]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-[#f2f5ec] p-4">
                <div>
                  <p className="font-bold text-slate-900">{selectedVehicle?.customer?.name ?? 'Select customer'}</p>
                  <p className="text-xs text-slate-500">{selectedVehicle?.customer?.mobile ?? ''} {selectedVehicle?.customer?.address ? `• ${selectedVehicle.customer.address}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Assigned Technician</p>
                  <p className="text-sm font-medium">Service Desk</p>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                  <h3 className="font-display text-[20px] font-semibold text-[#00450d]">Safety Measures</h3>
                  <div className="mt-5 space-y-3">
                    {topics.map((topic) => (
                      <div key={topic} className="flex items-start gap-3 rounded border border-slate-100 bg-white p-3">
                        <span className="material-symbols-outlined text-green-600">check_circle</span>
                        <p className="text-sm text-slate-700">{topic}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#1b5e20]">
                    <span>Module Completion</span>
                    <span>{acknowledged ? '100%' : '75%'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#1b5e20]" style={{ width: acknowledged ? '100%' : '75%' }} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-7 rounded-lg border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1b5e20]" />
            <h3 className="font-display text-[20px] font-semibold text-[#00450d] mb-4">Digital Acknowledgement</h3>
            <div className="space-y-4">
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">I confirm that the safety features and high-risk zones of the tractor have been explained to me.</div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">I have received the operator manual and maintenance schedule required for warranty validity.</div>
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">I understand the need for genuine TAFE spare parts and scheduled service adherence.</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Language</span>
                <select value={language} disabled={!isEditing} onChange={(e) => setLanguage(e.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm outline-none focus:border-[#1b5e20] disabled:bg-slate-50 disabled:text-slate-500">
                  <option>English</option>
                  <option>Tamil</option>
                  <option>Hindi</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded border border-[#acf4a4] bg-[#f3fbe9] px-4 text-sm">
                <input type="checkbox" checked={acknowledged} disabled={!isEditing} onChange={(e) => setAcknowledged(e.target.checked)} className="h-4 w-4 accent-[#1b5e20] disabled:opacity-100" />
                Customer accepted all terms and training points
              </label>
            </div>
          </section>

          <section className="col-span-12 lg:col-span-5 rounded-lg border border-slate-800 bg-slate-900 p-6 text-white shadow-sm">
            <div className="text-center space-y-4">
              <span className="material-symbols-outlined text-4xl text-green-500">vibration</span>
              <h3 className="font-display text-[22px] font-semibold">Final OTP Verification</h3>
              <p className="text-xs text-slate-400">A 6-digit code is sent to the registered customer mobile before finalizing.</p>
              <button
                type="button"
                onClick={() => {
                  setDosDontsViewed(true)
                  window.open('/safety/dos-donts', '_blank', 'noopener,noreferrer')
                }}
                className="w-full rounded border border-green-500/60 bg-green-500/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-green-200 hover:bg-green-500/20"
              >
                View Do's & Don'ts
              </button>
              {isEditing ? (
                <button
                  onClick={sendOtp}
                  disabled={!dosDontsViewed}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-3 text-[11px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {dosDontsViewed ? (otpSent ? 'Resend OTP' : 'Send OTP') : "View Do's & Don'ts First"}
                </button>
              ) : (
                <div className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-green-400">
                  OTP Verification Locked
                </div>
              )}
              {isEditing && !dosDontsViewed ? (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">View Do's & Don'ts to unlock OTP</p>
              ) : null}
              <input value={otp} disabled={!isEditing} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} className="h-12 w-full rounded bg-slate-800 px-4 text-center font-mono text-xl outline-none ring-1 ring-slate-700 focus:ring-green-500 disabled:text-slate-400" placeholder="000000" />
              {otp.length === 6 ? <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Verified Successfully</p> : null}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed bottom-0 left-[260px] right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center gap-8 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Current Module</p>
            <p className="font-bold text-[#00450d]">Safety & Training Completion</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Status</p>
            <p className="font-bold text-green-600">{isFinalized ? 'Locked after submit' : acknowledged ? 'Ready to submit' : 'Awaiting acknowledgement'}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate('/delivery')} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">Back</button>
          <button onClick={() => navigate('/rto')} disabled={!isFinalized} className="rounded border border-slate-300 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">Next Step</button>
          <button onClick={finalize} disabled={loading || !acknowledged || otp.length !== 6 || !isEditing} className="rounded bg-[#1b5e20] px-8 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60">
            {loading ? 'Finalizing...' : isFinalized && !isEditing ? 'Safety Locked' : 'Finalize Handover'}
          </button>
        </div>
      </div>
    </div>
  )
}
