import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuthStore } from '../store/auth.store'
import { getInitials } from '../lib/utils'

interface TopBarProps {
  placeholder?: string
}

export default function TopBar({ placeholder = 'Search Vehicle (VIN, Chassis, or Engine No.)' }: TopBarProps) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const flowTitle = useMemo(() => {
    const pathname = location.pathname
    const titleMap: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/purchase-invoices': 'Purchase Invoices',
      '/pdi': 'Pre-Delivery Inspection',
      '/installation': 'Installation Certificate',
      '/delivery': 'Customer Delivery Sheet',
      '/exchange': 'Exchange Registry',
      '/safety': 'Safety & Maintenance',
      '/insurance': 'Insurance Management',
      '/rto': 'RTO Documents',
      '/accounts': 'Accounts Module',
      '/ats': 'ATS Charge Sheet',
      '/service': 'Service Operations',
      '/field-service': 'Field Service Tablet',
      '/admin': 'Admin Control Center',
      '/profile': 'User Profile',
      '/guided-flow': 'Full Flow Guide',
    }
    if (pathname.startsWith('/search/')) return 'Search Results'
    if (pathname.startsWith('/vehicle-flow/')) return 'Vehicle Flow Tracker'
    return titleMap[pathname] ?? 'Dealer Management System'
  }, [location.pathname])

  const runSearch = () => {
    if (!query.trim()) {
      toast.error('Enter a vehicle, chassis, engine, customer, or invoice search term')
      return
    }
    navigate(`/search/${encodeURIComponent(query.trim())}`)
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runSearch()
    }
  }

  const showNotifications = async () => {
    const { data } = await api.get('/notifications')
    toast(data.slice(0, 3).map((item: any) => `${item.title}: ${item.message}`).join('\n'))
  }

  const showHelp = () => {
    toast('Use Purchase Invoice to create vehicles, Installation/Delivery to create customers, and Complete buttons to move workflow items.')
  }

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [])

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 right-0 left-[260px] h-[60px] z-40 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-6 flex-1">
        <div className="relative max-w-[448px] w-full">
          <button
            type="button"
            onClick={runSearch}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg hover:text-slate-600"
            aria-label="Search"
          >
            <span className="material-symbols-outlined">search</span>
          </button>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder={placeholder}
            className="h-9 pl-10 pr-4 bg-slate-50 border-none rounded text-sm w-full focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
      </div>

      <div className="hidden md:flex flex-col items-center">
        <span className="text-green-900 font-bold text-lg uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          {flowTitle}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={showNotifications} className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-all relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border border-white" />
        </button>
        <button onClick={showHelp} className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-all">
          <span className="material-symbols-outlined">help_outline</span>
        </button>
        <div className="h-8 w-px bg-slate-200" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-none uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                {user?.name ?? 'Owner User'}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{user?.role ?? 'Owner'}</p>
            </div>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#1b5e20] text-white shadow-sm">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                person
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-900 text-[8px] font-bold text-white">
                {user ? getInitials(user.name) : 'OU'}
              </span>
            </div>
            <span className="material-symbols-outlined text-base text-slate-500">expand_more</span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[220px] overflow-hidden rounded border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">{user?.name ?? 'Owner User'}</p>
                <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-500">{user?.email ?? 'owner@tafe.local'}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/profile')
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-500">person</span>
                User Profile
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  toast('Settings screen is part of admin configuration.')
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-500">settings</span>
                Settings
              </button>
              <div className="border-t border-slate-100" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
