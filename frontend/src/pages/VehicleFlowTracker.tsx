import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import PageHeader from '../components/ui/PageHeader'

type FlowStep = {
  key: string
  title: string
  route: string
  completed: boolean
  active: boolean
  available: boolean
  workItemId?: string | null
  workItemRef?: string | null
  workItemStatus?: string | null
  updatedAt?: string | null
}

type FlowResponse = {
  vehicle: {
    id: string
    code: string
    model: string
    engineNo: string
    chassisNo: string
    registrationNo?: string | null
    status: string
  }
  customer?: {
    id: string
    name: string
    mobile: string
    email?: string | null
  } | null
  steps: FlowStep[]
  currentStep?: FlowStep | null
  nextPending?: FlowStep | null
  summary: {
    completedCount: number
    totalCount: number
    deliveryFinalized: boolean
  }
}

export default function VehicleFlowTracker() {
  const { vehicleId = '' } = useParams()
  const navigate = useNavigate()
  const [flow, setFlow] = useState<FlowResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!vehicleId) return
    setLoading(true)
    api
      .get(`/vehicles/${vehicleId}/flow`)
      .then(({ data }) => setFlow(data))
      .catch(() => toast.error('Could not load vehicle flow'))
      .finally(() => setLoading(false))
  }, [vehicleId])

  const progressPercent = useMemo(() => {
    if (!flow?.summary.totalCount) return 0
    return Math.round((flow.summary.completedCount / flow.summary.totalCount) * 100)
  }, [flow])

  return (
    <div className="pb-10">
      <PageHeader
        icon="route"
        title="Vehicle Flow Tracker"
        subtitle={
          flow
            ? `Track completion status for ${flow.vehicle.model} (${flow.vehicle.code}) and move directly to the next required step.`
            : 'Track the full PRS workflow for a selected vehicle.'
        }
      />

      <div className="space-y-6 p-6">
        {loading ? (
          <section className="rounded border border-outline-variant bg-white p-5 text-sm text-on-surface-variant">
            Loading vehicle flow...
          </section>
        ) : null}

        {flow ? (
          <>
            <section className="rounded border border-outline-variant bg-white p-6">
              <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr_1fr]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Vehicle</p>
                  <h2 className="mt-2 font-display text-3xl font-bold text-green-950">{flow.vehicle.model}</h2>
                  <p className="mt-2 font-mono text-sm text-on-surface-variant">{flow.vehicle.code}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Engine: {flow.vehicle.engineNo} | Chassis: {flow.vehicle.chassisNo}
                  </p>
                  <p className="mt-2 inline-flex rounded bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-900">
                    Current vehicle status: {flow.vehicle.status}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Customer</p>
                  <div className="mt-2 rounded border border-outline-variant bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{flow.customer?.name ?? 'Not allocated yet'}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{flow.customer?.mobile ? `+91 ${flow.customer.mobile}` : 'Customer will appear after installation.'}</p>
                    {flow.customer?.email ? <p className="mt-1 text-sm text-on-surface-variant">{flow.customer.email}</p> : null}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Progress</p>
                  <div className="mt-2 rounded border border-outline-variant bg-slate-50 p-4">
                    <p className="font-space-grotesk text-3xl font-bold text-green-950">{progressPercent}%</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {flow.summary.completedCount} of {flow.summary.totalCount} steps complete
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-green-900" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded border border-[#cfe8c5] bg-[#f6fcf1] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-900">Current Stage</p>
                  <p className="mt-2 text-lg font-bold text-green-950">{flow.currentStep?.title ?? 'Workflow complete'}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {flow.currentStep
                      ? 'This is the stage the vehicle is currently waiting on or actively moving through.'
                      : 'All tracked lifecycle stages are complete for this vehicle.'}
                  </p>
                </div>
                <div className="rounded border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900">Next Action</p>
                  <p className="mt-2 text-lg font-bold text-amber-950">{flow.nextPending?.title ?? 'No pending steps'}</p>
                  <p className="mt-1 text-sm text-amber-900">
                    {flow.nextPending ? 'Open this module next and complete its required fields to continue the PRS flow.' : 'This vehicle has cleared the tracked main flow.'}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded border border-outline-variant bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-green-950">Lifecycle Tracker</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">See which steps are done, which step is active now, and jump straight into the correct module.</p>
                </div>
                {flow.nextPending ? (
                  <button
                    onClick={() => navigate(`${flow.nextPending.route}?vehicleId=${flow.vehicle.id}`)}
                    className="rounded bg-green-900 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
                  >
                    Open Next Step
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {flow.steps.map((step, index) => (
                  <div
                    key={step.key}
                    className={`rounded border p-4 ${
                      step.completed
                        ? 'border-[#b8ddb3] bg-[#f4fbf4]'
                        : step.active
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-outline-variant bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Step {index + 1}</p>
                        <h3 className="mt-2 font-space-grotesk text-lg font-bold text-slate-900">{step.title}</h3>
                      </div>
                      <span
                        className={`rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          step.completed
                            ? 'bg-green-900 text-white'
                            : step.active
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {step.completed ? 'Done' : step.active ? 'Current' : 'Pending'}
                      </span>
                    </div>
                    <p className="mt-4 text-sm text-slate-600">
                      {step.completed
                        ? 'This step is complete for the selected vehicle.'
                        : step.active
                          ? 'This is the current workflow stage for the vehicle.'
                          : 'This step is still waiting on the earlier stages.'}
                    </p>
                    {step.workItemRef ? (
                      <p className="mt-3 font-mono text-xs text-slate-500">
                        {step.workItemRef} {step.workItemStatus ? `• ${step.workItemStatus}` : ''}
                      </p>
                    ) : null}
                    <div className="mt-4">
                      <Link
                        to={`${step.route}?vehicleId=${flow.vehicle.id}`}
                        className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                          step.available ? 'border-green-900 text-green-900 hover:bg-green-50' : 'border-slate-200 text-slate-400 pointer-events-none'
                        }`}
                      >
                        Open Module
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : !loading ? (
          <section className="rounded border border-outline-variant bg-white p-5 text-sm text-on-surface-variant">
            Vehicle flow could not be loaded.
          </section>
        ) : null}
      </div>
    </div>
  )
}
