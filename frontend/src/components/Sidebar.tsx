import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../api/client'
import { canAccess } from '../lib/rbac'
import { useAuthStore } from '../store/auth.store'

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
}

const flowOrder = ['purchase', 'pdi', 'installation', 'delivery', 'exchange', 'safety', 'rto', 'insurance', 'accounts', 'ats']

const defaultModules = [
  { key: 'purchase', title: 'Purchase Invoices', route: '/purchase-invoices', icon: 'receipt_long' },
  { key: 'pdi', title: 'Pre-Delivery Inspection', route: '/pdi', icon: 'verified' },
  { key: 'installation', title: 'Installation Certificate', route: '/installation', icon: 'assignment_turned_in' },
  { key: 'delivery', title: 'Sales History', route: '/delivery', icon: 'history_edu' },
  { key: 'exchange', title: 'Exchange Registry', route: '/exchange', icon: 'swap_horiz' },
  { key: 'safety', title: 'Safety & Maintenance', route: '/safety', icon: 'construction' },
  { key: 'rto', title: 'RTO Documents', route: '/rto', icon: 'description' },
  { key: 'insurance', title: 'Insurance Management', route: '/insurance', icon: 'policy' },
  { key: 'accounts', title: 'Accounts Module', route: '/accounts', icon: 'account_balance' },
  { key: 'ats', title: 'ATS Charge Sheet', route: '/ats', icon: 'assignment_turned_in' },
  { key: 'service', title: 'Service Operations', route: '/service', icon: 'build' },
  { key: 'admin', title: 'Admin Control Center', route: '/admin', icon: 'admin_panel_settings' },
]

function sortByFlow(items: any[]) {
  return [...items].sort((a, b) => {
    const aIndex = flowOrder.indexOf(a.key)
    const bIndex = flowOrder.indexOf(b.key)
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
  })
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user } = useAuthStore()
  const [modules, setModules] = useState<any[]>(defaultModules)

  useEffect(() => {
    api.get('/modules')
      .then(({ data }) => {
        const moduleMap = new Map(defaultModules.map((item) => [item.key, item]))
        for (const item of data ?? []) {
          moduleMap.set(item.key, { ...item, ...moduleMap.get(item.key) })
        }
        setModules(Array.from(moduleMap.values()))
      })
      .catch(() => setModules(defaultModules))
  }, [])

  const linkBase = 'px-4 py-3 flex items-center gap-3 transition-colors font-label-caps text-xs uppercase tracking-wider'
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? `bg-slate-800 text-white border-l-4 border-green-800 ring-inset ring-1 ring-green-600 ${linkBase}`
      : `text-slate-400 hover:bg-slate-800 hover:text-white ${linkBase}`

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-[55] bg-slate-950/55 lg:hidden"
        />
      ) : null}
      <aside
        className={`fixed left-0 top-0 z-[60] flex h-screen w-[min(86vw,260px)] flex-col overflow-hidden border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:z-50 lg:w-[260px] lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-primary-container flex items-center justify-center rounded">
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            agriculture
          </span>
        </div>
        <div>
          <h1 className="text-white text-xl font-black tracking-tighter leading-none" style={{ fontFamily: 'Space Grotesk' }}>
            TAFE DMS
          </h1>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Industrial Precision</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-2">
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Core Operations</p>
        </div>

        <NavLink
          to="/dashboard"
          onClick={onClose}
          className={linkClass}
        >
          <span className="material-symbols-outlined text-lg">dashboard</span>
          Dashboard
        </NavLink>

        {sortByFlow(modules.filter((item) => item.key !== 'admin' && item.key !== 'service' && canAccess(user?.role, item.key))).map(({ route, icon, title }) => (
          <NavLink
            key={route}
            to={route}
            onClick={onClose}
            className={linkClass}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
            {title}
          </NavLink>
        ))}

        {canAccess(user?.role, 'service') || canAccess(user?.role, 'fieldService') ? (
          <>
            <div className="px-4 mt-4 mb-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Service</p>
            </div>

            {canAccess(user?.role, 'service') ? (
              <NavLink
                to="/service"
                onClick={onClose}
                className={linkClass}
              >
                <span className="material-symbols-outlined text-lg">build</span>
                Service Operations
              </NavLink>
            ) : null}

            {canAccess(user?.role, 'fieldService') ? (
              <NavLink
                to="/field-service"
                onClick={onClose}
                className={linkClass}
              >
                <span className="material-symbols-outlined text-lg">tablet_android</span>
                Field Tech
              </NavLink>
            ) : null}
          </>
        ) : null}

        {canAccess(user?.role, 'admin') ? (
          <>
            <div className="px-4 mt-4 mb-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Management</p>
            </div>
            {modules.filter((item) => item.key === 'admin').map(({ route, icon, title }) => (
              <NavLink
                key={route}
                to={route}
                onClick={onClose}
                className={linkClass}
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                {title}
              </NavLink>
            ))}
          </>
        ) : null}
      </nav>

    </aside>
    </>
  )
}
