import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'owner' | 'admin' | 'sales' | 'receptionist' | 'technician' | 'accounts' | 'rto_clerk'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  dealerCode: string
  dealerName: string
  initials: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, token: string, refreshToken?: string | null) => void
  clearAuth: () => void
  syncAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, token, refreshToken) => {
        localStorage.setItem('access_token', token)
        if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true })
      },
      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
      },
      syncAuth: () => {
        const token = localStorage.getItem('access_token')
        const refreshToken = localStorage.getItem('refresh_token')
        set((current) => ({
          ...current,
          token,
          refreshToken,
          isAuthenticated: Boolean(token && current.user),
          user: token ? current.user : null,
        }))
      },
    }),
    { name: 'tafe-dms-auth', partialize: (s) => ({ user: s.user, token: s.token, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }) },
  ),
)
