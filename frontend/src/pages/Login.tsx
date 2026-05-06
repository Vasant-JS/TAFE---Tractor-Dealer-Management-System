import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuthStore, UserRole } from '../store/auth.store'

const availableRoles: { label: string; role: UserRole }[] = [
  { label: 'owner', role: 'owner' },
  { label: 'admin', role: 'admin' },
  { label: 'sales', role: 'sales' },
  { label: 'receptionist', role: 'receptionist' },
  { label: 'technician', role: 'technician' },
  { label: 'accounts', role: 'accounts' },
  { label: 'rto clerk', role: 'rto_clerk' },
]

export default function Login() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState<UserRole>('owner')
  const [remember, setRemember] = useState(true)
  const [roles] = useState<{ label: string; role: UserRole }[]>(availableRoles)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState(searchParams.get('email') ?? '')
  const [resetToken, setResetToken] = useState(searchParams.get('resetToken') ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [showReset, setShowReset] = useState(Boolean(searchParams.get('resetToken')))

  const login = async () => {
    if (!email || !password) {
      toast.error('Enter username/email and password')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Enter a valid email address')
      return
    }
    try {
      const { data } = await api.post('/auth/login', { email, password, role })
      setAuth({ ...data.user, initials: 'JD' }, data.accessToken, data.refreshToken)
      toast.success('Connected to backend and signed in')
      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Login failed')
    }
  }

  const requestReset = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      toast.error('Enter a valid registered email first')
      return
    }
    try {
      const { data } = await api.post('/auth/request-password-reset', { email: resetEmail.trim() })
      if (data.resetLink) {
        setResetToken(new URLSearchParams(data.resetLink.split('?')[1]).get('resetToken') ?? '')
        toast.success('Reset link generated. Token loaded into the form below.')
      } else {
        toast.success(data.message)
      }
      setShowReset(true)
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Could not generate password reset link')
    }
  }

  const completeReset = async () => {
    if (!resetToken.trim()) {
      toast.error('Enter the reset token')
      return
    }
    if (newPassword.length < 8 || !/[^A-Za-z0-9]/.test(newPassword)) {
      toast.error('Password must be at least 8 characters and include one special character')
      return
    }
    try {
      await api.post('/auth/reset-password', { email: resetEmail.trim(), token: resetToken.trim(), password: newPassword })
      toast.success('Password reset successful. You can log in now.')
      setShowReset(false)
      setPassword('')
      setNewPassword('')
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Password reset failed')
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1600&q=80"
          alt="TAFE tractor field operation"
          className="h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
        <div className="absolute left-12 top-12 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-green-800 text-white">
            <span className="material-symbols-outlined">agriculture</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-white">TAFE DMS</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-green-200">Dealer Management System</p>
          </div>
        </div>
        <div className="absolute bottom-14 left-12 max-w-xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-amber-300">Industrial Precision</p>
          <h2 className="font-display text-5xl font-bold leading-tight text-white">Procurement, delivery, service, and accounts in one controlled workflow.</h2>
        </div>
      </section>

      <section className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded border border-outline-variant bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary">Secure Dealer Login</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-green-950">Dealer Login</h2>
            <p className="mt-2 text-sm text-on-surface-variant">Sign in using a user role loaded from the database.</p>
          </div>
          <div className="space-y-4">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Username / Email</span>
              <input type="email" className="h-11 w-full rounded border border-outline-variant px-3 outline-none focus:border-green-900" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter email" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Password</span>
              <input type="password" className="h-11 w-full rounded border border-outline-variant px-3 outline-none focus:border-green-900" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" />
            </label>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Role</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {roles.map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => setRole(item.role)}
                    className={`rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider ${role === item.role ? 'border-green-900 bg-green-900 text-white' : 'border-outline-variant bg-white text-on-surface'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="accent-green-900" />
              Remember me
            </label>
            <button onClick={login} className="flex h-11 w-full items-center justify-center gap-2 rounded bg-green-900 font-display text-sm font-bold uppercase tracking-wider text-white">
              <span className="material-symbols-outlined text-lg">login</span>
              Sign In
            </button>
            <button type="button" onClick={() => setShowReset((value) => !value)} className="w-full text-center text-xs font-bold uppercase tracking-wider text-green-900">
              {showReset ? 'Hide Password Reset' : 'Forgot Password'}
            </button>
            {showReset ? (
              <div className="rounded border border-outline-variant bg-slate-50 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Password Reset</p>
                <div className="space-y-3">
                  <input type="email" className="h-11 w-full rounded border border-outline-variant px-3 outline-none focus:border-green-900" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="Registered email" />
                  <div className="flex gap-2">
                    <button type="button" onClick={requestReset} className="flex-1 rounded border border-green-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-green-900">
                      Generate Reset Link
                    </button>
                  </div>
                  <input type="text" className="h-11 w-full rounded border border-outline-variant px-3 outline-none focus:border-green-900" value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Reset token" />
                  <input type="password" className="h-11 w-full rounded border border-outline-variant px-3 outline-none focus:border-green-900" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" />
                  <button type="button" onClick={completeReset} className="w-full rounded bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">
                    Reset Password
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
