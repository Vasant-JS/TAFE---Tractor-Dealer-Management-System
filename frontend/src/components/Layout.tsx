import { Outlet, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useAuthStore } from '../store/auth.store'

export default function Layout() {
  const { isAuthenticated, clearAuth } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) return
    let timeout: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        clearAuth()
        window.location.href = '/login'
      }, 60 * 60 * 1000)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((eventName) => window.addEventListener(eventName, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timeout)
      events.forEach((eventName) => window.removeEventListener(eventName, reset))
    }
  }, [isAuthenticated, clearAuth])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopBar />
      <main className="ml-[260px] pt-[60px] min-h-screen pb-8">
        <Outlet />
      </main>
    </div>
  )
}
