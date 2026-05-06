import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import StatusPill from '../components/ui/StatusPill'

export default function SearchResults() {
  const { query = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<any>({ customers: [], vehicles: [], workItems: [] })

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([api.get('/customers'), api.get('/vehicles'), api.get('/work-items')])
      .then(([customerRes, vehicleRes, workItemRes]) => {
        if (!active) return
        const needle = query.trim().toLowerCase()
        const includes = (value: unknown) => String(value ?? '').toLowerCase().includes(needle)

        const customers = (customerRes.data ?? []).filter((customer: any) => includes(customer.name) || includes(customer.mobile) || includes(customer.aadhaar) || includes(customer.email))
        const vehicles = (vehicleRes.data ?? []).filter((vehicle: any) => includes(vehicle.code) || includes(vehicle.engineNo) || includes(vehicle.chassisNo) || includes(vehicle.model) || includes(vehicle.registrationNo))
        const workItems = (workItemRes.data ?? []).filter((item: any) => includes(item.ref) || includes(item.status) || includes(item.customer?.name) || includes(item.vehicle?.model) || includes(item.vehicle?.code))

        setResults({
          customers: customers.slice(0, 20),
          vehicles: vehicles.slice(0, 20),
          workItems: workItems.slice(0, 20),
        })
      })
      .catch(() => {
        if (!active) return
        setResults({ customers: [], vehicles: [], workItems: [] })
        toast.error('Search failed')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query])

  const hasResults = useMemo(() => results.customers.length || results.vehicles.length || results.workItems.length, [results])

  return (
    <div>
      <PageHeader icon="search" title="Search Results" subtitle={`Live database results for "${query}".`} />
      <div className="grid gap-6 p-6 xl:grid-cols-3">
        <section className="rounded border border-outline-variant bg-white">
          <h2 className="border-b border-outline-variant px-5 py-4 font-display text-xl font-semibold text-green-950">Customers</h2>
          <div className="space-y-2 p-4">
            {results.customers.map((customer: any) => (
              <div key={customer.id} className="rounded border border-outline-variant p-3">
                <p className="font-semibold">{customer.name}</p>
                <p className="font-mono text-xs text-on-surface-variant">+91 {customer.mobile}</p>
              </div>
            ))}
            {!loading && !results.customers.length ? <p className="text-sm text-on-surface-variant">No customer matches.</p> : null}
          </div>
        </section>
        <section className="rounded border border-outline-variant bg-white">
          <h2 className="border-b border-outline-variant px-5 py-4 font-display text-xl font-semibold text-green-950">Vehicles</h2>
          <div className="space-y-2 p-4">
            {results.vehicles.map((vehicle: any) => (
              <Link key={vehicle.id} to={`/vehicle-flow/${vehicle.id}`} className="block rounded border border-outline-variant p-3 hover:border-green-900 hover:bg-green-50/40">
                <p className="font-semibold">{vehicle.model}</p>
                <p className="font-mono text-xs text-on-surface-variant">{vehicle.code}</p>
                <p className="mt-1 text-xs text-on-surface-variant">Open full lifecycle tracker for this vehicle.</p>
                <StatusPill tone={vehicle.status === 'Pending PDI' ? 'warning' : 'success'}>{vehicle.status}</StatusPill>
              </Link>
            ))}
            {!loading && !results.vehicles.length ? <p className="text-sm text-on-surface-variant">No vehicle matches.</p> : null}
          </div>
        </section>
        <section className="rounded border border-outline-variant bg-white">
          <h2 className="border-b border-outline-variant px-5 py-4 font-display text-xl font-semibold text-green-950">Work Items</h2>
          <div className="space-y-2 p-4">
            {results.workItems.map((item: any) => (
              <Link key={item.id} to={`/${item.moduleKey === 'purchase' ? 'purchase-invoices' : item.moduleKey}`} className="block rounded border border-outline-variant p-3 hover:border-green-900">
                <p className="font-mono text-xs font-bold">{item.ref}</p>
                <p className="text-sm">{item.customer?.name ?? ''} {item.vehicle?.model ? `- ${item.vehicle.model}` : ''}</p>
                <StatusPill tone={item.status === 'Complete' ? 'success' : 'warning'}>{item.status}</StatusPill>
              </Link>
            ))}
            {!loading && !results.workItems.length ? <p className="text-sm text-on-surface-variant">No work item matches.</p> : null}
          </div>
        </section>
      </div>
      {loading ? <div className="px-6 pb-6 text-sm text-on-surface-variant">Loading search results...</div> : null}
      {!loading && !hasResults ? <div className="px-6 pb-6 text-sm text-on-surface-variant">No matching records were found in the live database for this query.</div> : null}
    </div>
  )
}
