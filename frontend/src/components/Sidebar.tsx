import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../api/client'
import { canAccess } from '../lib/rbac'
import { useAuthStore } from '../store/auth.store'

const flowOrder = ['purchase', 'pdi', 'installation', 'delivery', 'exchange', 'safety', 'insurance', 'rto', 'accounts', 'ats']

function sortByFlow(items: any[]) {
  return [...items].sort((a, b) => {
    const aIndex = flowOrder.indexOf(a.key)
    const bIndex = flowOrder.indexOf(b.key)
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
  })
}

export default function Sidebar() {
  const { user } = useAuthStore()
  const [modules, setModules] = useState<any[]>([])

  useEffect(() => {
    api.get('/modules').then(({ data }) => setModules(data))
  }, [])

  return (
    <aside className="fixed left-0 top-0 w-[260px] h-screen z-50 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-2">
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Core Operations</p>
        </div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive
              ? 'bg-slate-800 text-white border-l-4 border-green-800 px-4 py-3 flex items-center gap-3 ring-inset ring-1 ring-green-600 font-label-caps text-xs uppercase tracking-wider'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white px-4 py-3 flex items-center gap-3 transition-colors font-label-caps text-xs uppercase tracking-wider'
          }
        >
          <span className="material-symbols-outlined text-lg">dashboard</span>
          Dashboard
        </NavLink>

        {sortByFlow(modules.filter((item) => item.key !== 'admin' && item.key !== 'service' && canAccess(user?.role, item.key))).map(({ route, icon, title }) => (
          <NavLink
            key={route}
            to={route}
            className={({ isActive }) =>
              isActive
                ? 'bg-slate-800 text-white border-l-4 border-green-800 px-4 py-3 flex items-center gap-3 ring-inset ring-1 ring-green-600 font-label-caps text-xs uppercase tracking-wider'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white px-4 py-3 flex items-center gap-3 transition-colors font-label-caps text-xs uppercase tracking-wider'
            }
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
                className={({ isActive }) =>
                  isActive
                    ? 'bg-slate-800 text-white border-l-4 border-green-800 px-4 py-3 flex items-center gap-3 ring-inset ring-1 ring-green-600 font-label-caps text-xs uppercase tracking-wider'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white px-4 py-3 flex items-center gap-3 transition-colors font-label-caps text-xs uppercase tracking-wider'
                }
              >
                <span className="material-symbols-outlined text-lg">build</span>
                Service Operations
              </NavLink>
            ) : null}

            {canAccess(user?.role, 'fieldService') ? (
              <NavLink
                to="/field-service"
                className={({ isActive }) =>
                  isActive
                    ? 'bg-slate-800 text-white border-l-4 border-green-800 px-4 py-3 flex items-center gap-3 ring-inset ring-1 ring-green-600 font-label-caps text-xs uppercase tracking-wider'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white px-4 py-3 flex items-center gap-3 transition-colors font-label-caps text-xs uppercase tracking-wider'
                }
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
                className={({ isActive }) =>
                  isActive
                    ? 'bg-slate-800 text-white border-l-4 border-green-800 px-4 py-3 flex items-center gap-3 ring-inset ring-1 ring-green-600 font-label-caps text-xs uppercase tracking-wider'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white px-4 py-3 flex items-center gap-3 transition-colors font-label-caps text-xs uppercase tracking-wider'
                }
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                {title}
              </NavLink>
            ))}
          </>
        ) : null}
      </nav>

    </aside>
  )
}
