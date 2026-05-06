import type { UserRole } from '../store/auth.store'

export const moduleRoleAccess: Record<string, UserRole[]> = {
  dashboard: ['owner', 'admin', 'sales', 'receptionist', 'technician', 'accounts', 'rto_clerk'],
  purchase: ['owner', 'admin'],
  pdi: ['owner', 'admin', 'sales'],
  installation: ['owner', 'admin', 'sales'],
  delivery: ['owner', 'admin', 'sales'],
  exchange: ['owner', 'admin', 'sales'],
  safety: ['owner', 'admin', 'sales', 'technician', 'receptionist'],
  insurance: ['owner', 'admin', 'sales'],
  rto: ['owner', 'admin', 'rto_clerk'],
  accounts: ['owner', 'admin', 'accounts'],
  ats: ['owner', 'admin', 'accounts'],
  service: ['owner', 'admin', 'sales', 'technician', 'receptionist'],
  fieldService: ['technician'],
  admin: ['owner', 'admin'],
  profile: ['owner', 'admin', 'sales', 'receptionist', 'technician', 'accounts', 'rto_clerk'],
}

export function canAccess(role: UserRole | undefined, moduleKey: keyof typeof moduleRoleAccess | string) {
  if (!role) return false
  const allowed = moduleRoleAccess[moduleKey]
  return allowed ? allowed.includes(role) : false
}
