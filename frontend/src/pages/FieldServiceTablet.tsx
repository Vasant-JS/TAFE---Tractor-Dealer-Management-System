import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuthStore } from '../store/auth.store'

type Vehicle = {
  id: string
  code: string
  model: string
  status: string
  chassisNo?: string | null
  customer?: {
    name: string
    mobile: string
    address?: string | null
  } | null
}

type Row = {
  id: string
  ref?: string
  status: string
  createdAt?: string
  updatedAt?: string
  payload?: string | null
  vehicle?: Vehicle | null
  customer?: Vehicle['customer']
  documents?: Array<{ id: string; name: string; status: string }>
  owner?: { name?: string | null } | null
}

type TaskState = 'PASS' | 'FAIL' | 'N/A'

const checklistSeed = [
  'Inspect engine oil level and filter condition',
  'Check coolant level and radiator fins',
  'Inspect battery terminals and charge',
  'Verify clutch pedal free play',
  'Inspect brake response and oil level',
  'Check front axle and steering linkage',
  'Verify hydraulic lift function',
  'Inspect tyre condition and tread wear',
  'Test lighting and horn operation',
  'Check PTO engagement and guards',
  'Inspect cabin controls and instrumentation',
  'Capture completion evidence and customer notes',
]

const partsSeed = [
  { partId: 'TF-OIL-FIL-99', description: 'Engine Oil Filter - 2.5L Capacity', unitPrice: 850, quantity: 1 },
  { partId: 'TF-SYN-ENG-OIL', description: 'Synthetic Engine Oil (5L Drum)', unitPrice: 3200, quantity: 2 },
]

function parsePayload(payload?: string | null) {
  try {
    return payload ? JSON.parse(payload) : {}
  } catch {
    return {}
  }
}

function formatMoment(input?: string) {
  if (!input) return 'Pending actions'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function FieldServiceTablet() {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<Row[]>([])
  const [selectedRowId, setSelectedRowId] = useState('')
  const [taskIndex, setTaskIndex] = useState(0)
  const [taskStates, setTaskStates] = useState<Record<number, TaskState>>({})
  const [parts, setParts] = useState(partsSeed)
  const [otpDigits, setOtpDigits] = useState(['8', '1', '', '', '', ''])
  const [syncLabel, setSyncLabel] = useState('SYNCED: JUST NOW')

  const load = async () => {
    const rowsResponse = await api.get('/modules/service/work-items')
    setRows(rowsResponse.data)
    if (rowsResponse.data?.[0]) {
      setSelectedRowId((current) => current || rowsResponse.data[0].id)
    }
  }

  useEffect(() => {
    load().catch(() => toast.error('Could not load technician job card'))
  }, [])

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedRowId) ?? rows[0] ?? null, [rows, selectedRowId])
  const payload = useMemo(() => parsePayload(selectedRow?.payload), [selectedRow?.payload])
  const completionCount = useMemo(() => Object.values(taskStates).filter((value) => value === 'PASS').length, [taskStates])
  const progressPercent = Math.max(20, Math.min(100, Math.round((completionCount / checklistSeed.length) * 100)))
  const totalEstimate = parts.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  const serviceStatus = String(selectedRow?.status ?? 'Raised')
  const statusTimeline = [
    { key: 'Raised', done: true, label: 'Raised', time: formatMoment(selectedRow?.createdAt) },
    {
      key: 'Allocated',
      done: Boolean(selectedRow?.owner?.name) || serviceStatus.toLowerCase().includes('allocated') || serviceStatus.toLowerCase().includes('progress') || serviceStatus.toLowerCase().includes('complete'),
      label: 'Allocated',
      time: selectedRow?.owner?.name ? formatMoment(selectedRow?.updatedAt) : 'Pending actions',
    },
    {
      key: 'Completed',
      done: serviceStatus.toLowerCase().includes('complete'),
      label: 'Completed',
      time: serviceStatus.toLowerCase().includes('complete') ? formatMoment(selectedRow?.updatedAt) : 'Pending actions',
    },
  ]

  const assignTaskState = (state: TaskState) => {
    setTaskStates((current) => ({ ...current, [taskIndex]: state }))
    if (taskIndex < checklistSeed.length - 1) {
      setTaskIndex((current) => current + 1)
    }
  }

  const adjustPartQuantity = (partId: string, delta: number) => {
    setParts((current) =>
      current.map((item) =>
        item.partId === partId
          ? {
              ...item,
              quantity: Math.max(0, item.quantity + delta),
            }
          : item,
      ),
    )
  }

  const completeServiceOrder = async () => {
    if (!selectedRow) return
    try {
      await api.patch(`/work-items/${selectedRow.id}/status`, { status: 'Complete' })
      setSyncLabel('SYNCED: JUST NOW')
      toast.success('Service order completed')
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not complete service order')
    }
  }

  if (!selectedRow) {
    return (
      <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] p-8">
        <div className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-600">No technician job card is available yet.</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-28">
      <div className="mx-auto max-w-[1500px] px-8 py-6">
        <section className="mb-6 rounded border-l-8 border-[#ba1a1a] bg-[#ffdad6] px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-3xl text-[#ba1a1a]">warning</span>
              <div>
                <h4 className="text-[22px] font-semibold leading-tight text-[#93000a]" style={{ fontFamily: 'Space Grotesk' }}>PAYMENT OVERDUE</h4>
                <p className="text-sm text-[#93000a]">Customer account has a pending balance of Rs 14,250. Obtain manager approval before proceeding.</p>
              </div>
            </div>
            <button className="bg-[#ba1a1a] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white">Resolve</button>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <div className="relative border border-slate-200 border-l-4 border-l-[#00450d] bg-white p-6">
              <div className="absolute right-6 top-4 text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">ATS Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#ba1a1a]" />
                  <span className="text-sm font-bold text-[#ba1a1a]">RED (CRITICAL)</span>
                </div>
              </div>
              <h2 className="text-[34px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>{selectedRow.customer?.name ?? 'Customer Pending'}</h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <span className="material-symbols-outlined text-base">location_on</span>
                {selectedRow.customer?.address ?? 'Village Hardoli, Tehsil Saoner, Nagpur, MH'}
              </p>
              <div className="mt-8 grid grid-cols-1 gap-6 border-t border-slate-100 pt-6 md:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Vehicle Model</p>
                  <p className="mt-1 text-[22px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>{selectedRow.vehicle?.model ?? 'Vehicle Pending'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Chassis Number</p>
                  <p className="mt-1 font-mono text-[16px] text-slate-900">{selectedRow.vehicle?.chassisNo ?? selectedRow.vehicle?.code ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Engine Hours</p>
                  <p className="mt-1 font-mono text-[16px] text-slate-900">{payload['Engine Hours'] ?? '1,248.5 HRS'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="flex h-full flex-col justify-between border-l-4 border-l-[#ff8f00] bg-[#1b5e20] p-6 text-white">
              <div>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Service Progress</p>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[30px] font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{progressPercent}%</span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-white/70">Job In Progress</span>
                </div>
                <div className="h-3 w-full overflow-hidden bg-white/20">
                  <div className="h-full bg-[#ff8f00]" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
              <div className="mt-8 flex items-end justify-between">
                <div className="text-sm">
                  <p className="text-white/70">Estimated Completion</p>
                  <p className="font-semibold">{payload['Estimated Date'] ?? 'Today'} {payload['Estimated Time'] ? `| ${payload['Estimated Time']}` : ''}</p>
                </div>
                <span className="material-symbols-outlined text-4xl text-white/40">moped</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="mb-4 flex items-center gap-3 text-[24px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="material-symbols-outlined text-[#00450d]">fact_check</span>
            Service Checklist
          </h3>
          <div className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Current Task: Inspection ({Math.min(taskIndex + 1, checklistSeed.length)} of {checklistSeed.length})</span>
              <span className="font-mono text-sm font-bold text-[#00450d]">MANDATORY ITEM</span>
            </div>
            <div className="p-10 text-center">
              <h4 className="mx-auto mb-8 max-w-3xl text-[34px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>{checklistSeed[taskIndex]}</h4>
              <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
                {[
                  ['PASS', 'check_circle', 'border-slate-200 hover:border-[#1b5e20] hover:bg-green-50 text-slate-300 hover:text-[#1b5e20]'],
                  ['FAIL', 'error', 'border-[#ba1a1a] hover:bg-red-50 text-[#ba1a1a]'],
                  ['N/A', 'do_not_disturb_on', 'border-slate-200 hover:bg-slate-50 text-slate-300 hover:text-slate-500'],
                ].map(([label, icon, classes]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => assignTaskState(label as TaskState)}
                    className={`group flex flex-col items-center justify-center gap-4 border-2 p-8 transition-all ${classes}`}
                  >
                    <span className="material-symbols-outlined text-5xl">{icon}</span>
                    <span className={`text-lg font-bold uppercase tracking-[0.14em] ${label === 'FAIL' ? 'text-[#ba1a1a]' : 'text-slate-700'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="mb-4 flex items-center gap-3 text-[24px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="material-symbols-outlined text-[#00450d]">inventory_2</span>
            Parts &amp; Consumables
          </h3>
          <div className="overflow-x-auto border border-slate-900 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#00450d] text-white">
                  <th className="border-r border-white/10 p-4 text-[11px] font-bold uppercase tracking-[0.14em]">Part ID</th>
                  <th className="border-r border-white/10 p-4 text-[11px] font-bold uppercase tracking-[0.14em]">Description</th>
                  <th className="border-r border-white/10 p-4 text-[11px] font-bold uppercase tracking-[0.14em]">Unit Price</th>
                  <th className="border-r border-white/10 p-4 text-center text-[11px] font-bold uppercase tracking-[0.14em]">Quantity</th>
                  <th className="p-4 text-right text-[11px] font-bold uppercase tracking-[0.14em]">Total</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((item, index) => (
                  <tr key={item.partId} className={index % 2 ? 'bg-[#f4f4f2] border-b border-slate-200' : 'bg-white border-b border-slate-200'}>
                    <td className="border-r border-slate-100 p-4 font-mono text-[13px]">{item.partId}</td>
                    <td className="border-r border-slate-100 p-4 text-[14px]">{item.description}</td>
                    <td className="border-r border-slate-100 p-4 font-mono text-[13px]">Rs {item.unitPrice.toLocaleString('en-IN')}</td>
                    <td className="border-r border-slate-100 p-4">
                      <div className="flex items-center justify-center gap-4">
                        <button type="button" onClick={() => adjustPartQuantity(item.partId, -1)} className="flex h-10 w-10 items-center justify-center border border-slate-300 hover:bg-slate-50">-</button>
                        <span className="w-6 text-center font-mono text-xl font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => adjustPartQuantity(item.partId, 1)} className="flex h-10 w-10 items-center justify-center border border-slate-300 hover:bg-slate-50">+</button>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold">Rs {(item.unitPrice * item.quantity).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="flex w-full items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#00450d] hover:bg-slate-100">
              <span className="material-symbols-outlined">add_circle</span>
              Add New Line Item
            </button>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="mb-4 flex items-center gap-3 text-[24px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="material-symbols-outlined text-[#00450d]">photo_camera</span>
            Photo Documentation
          </h3>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <button type="button" className="flex aspect-square h-full w-full flex-col items-center justify-center gap-4 border-4 border-dashed border-slate-200 text-slate-400 transition-all hover:border-[#1b5e20] hover:bg-green-50 hover:text-[#1b5e20]">
                <span className="material-symbols-outlined text-7xl">add_a_photo</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Capture Evidence</span>
              </button>
            </div>
            <div className="xl:col-span-8">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {['BEFORE - ENGINE BLOCK', 'CONDITION - TIRE TREAD', 'INSTRUMENT CLUSTER', 'SPARE SLOT AVAILABLE'].map((label, index) => (
                  <div key={label} className={`group relative aspect-video overflow-hidden ${index === 3 ? 'border-2 border-dashed border-slate-300 bg-slate-100' : 'bg-slate-200'}`}>
                    {index === 3 ? (
                      <div className="flex h-full items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-slate-300">image</span>
                      </div>
                    ) : (
                      <>
                        <img
                          src={index === 0 ? 'https://images.unsplash.com/photo-1530041539828-114de669390e?auto=format&fit=crop&w=900&q=80' : index === 1 ? 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80' : 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=900&q=80'}
                          alt={label}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/40 opacity-0 transition-all group-hover:opacity-100">
                          <span className="material-symbols-outlined cursor-pointer text-white">visibility</span>
                          <span className="material-symbols-outlined cursor-pointer text-white">delete</span>
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div className="border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-[20px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Customer Digital Signature</h3>
            <div className="relative min-h-[220px] border border-slate-200 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]">
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button type="button" className="bg-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Clear</button>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] italic text-slate-400">I acknowledge that the above services were performed to my satisfaction.</p>
          </div>
          <div className="border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-center text-[20px] font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Verification OTP</h3>
            <p className="mb-6 text-center text-sm text-slate-500">Enter the 6-digit code sent to customer mobile number (+91 XXX-XXX-1298)</p>
            <div className="flex justify-center gap-3">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  value={digit}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, '').slice(-1)
                    setOtpDigits((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))
                  }}
                  className="h-16 w-12 border-2 border-slate-200 text-center text-2xl font-bold outline-none focus:border-[#1b5e20]"
                />
              ))}
            </div>
            <div className="mt-6 text-center">
              <button type="button" className="text-sm font-bold text-[#00450d] underline">Resend Code (45s)</button>
            </div>
          </div>
        </section>
      </div>

      <footer className="fixed bottom-0 right-0 left-[260px] z-40 flex items-center justify-between border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Total Estimate</span>
            <span className="font-mono text-xl font-bold text-slate-900">Rs {totalEstimate.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600">cloud_done</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{syncLabel}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={() => toast.success('Service draft saved locally')} className="border-2 border-slate-200 px-8 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-50">
            Save Draft
          </button>
          <button type="button" onClick={completeServiceOrder} className="flex items-center gap-3 bg-[#00450d] px-10 py-3 text-[16px] font-bold uppercase tracking-[0.14em] text-white">
            Complete Service Order
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </footer>
    </div>
  )
}
