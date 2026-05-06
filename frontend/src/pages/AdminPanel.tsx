import { useEffect, useState } from 'react'
import api from '../api/client'

const roles = ['owner', 'admin', 'sales', 'receptionist', 'technician', 'accounts', 'rto_clerk']
const INSURANCE_COMPANIES_KEY = 'insurance-master-companies'
const INSURANCE_POLICY_TYPES_KEY = 'insurance-master-policy-types'
const defaultInsuranceCompanies = ['ICICI Lombard', 'HDFC ERGO', 'New India Assurance']
const defaultPolicyTypes = ['Comprehensive', 'Third Party Only', 'Zero Dep']

export default function AdminPanel() {
  const [modules, setModules] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [insuranceCompanies, setInsuranceCompanies] = useState<string[]>(defaultInsuranceCompanies)
  const [policyTypes, setPolicyTypes] = useState<string[]>(defaultPolicyTypes)
  const [newCompany, setNewCompany] = useState('')
  const [newPolicyType, setNewPolicyType] = useState('')

  useEffect(() => {
    Promise.all([api.get('/modules'), api.get('/users'), api.get('/audit')]).then(([modulesRes, usersRes, auditRes]) => {
      setModules(modulesRes.data)
      setUsers(usersRes.data)
      setAudit(auditRes.data)
    })
    try {
      const savedCompanies = JSON.parse(localStorage.getItem(INSURANCE_COMPANIES_KEY) || 'null')
      const savedPolicyTypes = JSON.parse(localStorage.getItem(INSURANCE_POLICY_TYPES_KEY) || 'null')
      if (Array.isArray(savedCompanies) && savedCompanies.length) setInsuranceCompanies(savedCompanies)
      if (Array.isArray(savedPolicyTypes) && savedPolicyTypes.length) setPolicyTypes(savedPolicyTypes)
    } catch {}
  }, [])

  const addInsuranceCompany = () => {
    const value = newCompany.trim()
    if (!value) return
    if (insuranceCompanies.some((item) => item.toLowerCase() === value.toLowerCase())) return
    const next = [...insuranceCompanies, value]
    setInsuranceCompanies(next)
    localStorage.setItem(INSURANCE_COMPANIES_KEY, JSON.stringify(next))
    setNewCompany('')
  }

  const addPolicyType = () => {
    const value = newPolicyType.trim()
    if (!value) return
    if (policyTypes.some((item) => item.toLowerCase() === value.toLowerCase())) return
    const next = [...policyTypes, value]
    setPolicyTypes(next)
    localStorage.setItem(INSURANCE_POLICY_TYPES_KEY, JSON.stringify(next))
    setNewPolicyType('')
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f7fbf1] pb-12">
      <div className="mx-auto max-w-[1380px] px-8 py-8 space-y-6">
        <div>
          <h1 className="font-display text-[30px] font-bold text-[#00450d]">Admin Control Center</h1>
          <p className="text-slate-500">Role access, master workflow definitions, and audit visibility.</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 shadow-sm border-l-4 border-[#1b5e20]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Modules</div>
            <div className="mt-2 font-mono text-[28px] font-bold text-[#00450d]">{modules.length}</div>
          </div>
          <div className="bg-white p-5 shadow-sm border-l-4 border-[#8f4e00]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Users</div>
            <div className="mt-2 font-mono text-[28px] font-bold text-[#00450d]">{users.length}</div>
          </div>
          <div className="bg-white p-5 shadow-sm border-l-4 border-[#dc2626]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Audit Events</div>
            <div className="mt-2 font-mono text-[28px] font-bold text-[#00450d]">{audit.length}</div>
          </div>
        </div>

        <section className="rounded border border-outline-variant bg-white">
          <div className="border-b border-outline-variant px-5 py-4">
            <h2 className="font-display text-xl font-semibold text-green-950">RBAC Matrix</h2>
            <p className="text-xs text-slate-500">Frontend route access is now aligned to PRS-style role visibility.</p>
          </div>
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-green-900 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Module</th>
                  {roles.map((role) => <th key={role} className="px-3 py-2 text-left uppercase">{role}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map((module: any, index) => (
                  <tr key={module.key} className={index % 2 ? 'bg-[#f2f5ec]' : 'bg-white'}>
                    <td className="px-3 py-2 font-semibold">{module.title}</td>
                    {roles.map((role) => {
                      const allowed =
                        ['owner', 'admin'].includes(role) ||
                        (module.key === 'rto' && role === 'rto_clerk') ||
                        (['accounts', 'ats'].includes(module.key) && role === 'accounts') ||
                        (['purchase', 'installation', 'delivery', 'insurance', 'exchange'].includes(module.key) && ['sales', 'receptionist'].includes(role)) ||
                        (['pdi', 'safety', 'service'].includes(module.key) && role === 'technician')
                      return (
                        <td key={role} className="px-3 py-2">
                          <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${allowed ? 'bg-[#acf4a4] text-[#0c5216]' : 'bg-slate-100 text-slate-500'}`}>
                            {allowed ? 'Allow' : 'Block'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-xl font-semibold text-green-950">Insurance Master Controls</h2>
              <p className="text-xs text-slate-500">Add new insurance companies and policy types for the Insurance module.</p>
            </div>
            <div className="grid gap-6 p-5 lg:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-end gap-3">
                  <label className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Add Insurance Company</span>
                    <input value={newCompany} onChange={(event) => setNewCompany(event.target.value)} className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1b5e20]" placeholder="Ex: Bajaj Allianz" />
                  </label>
                  <button onClick={addInsuranceCompany} className="rounded bg-[#1b5e20] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white">
                    Add
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {insuranceCompanies.map((company) => (
                    <span key={company} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 border border-slate-200">{company}</span>
                  ))}
                </div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-end gap-3">
                  <label className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Add Policy Type</span>
                    <input value={newPolicyType} onChange={(event) => setNewPolicyType(event.target.value)} className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1b5e20]" placeholder="Ex: Standalone Own Damage" />
                  </label>
                  <button onClick={addPolicyType} className="rounded bg-[#1b5e20] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white">
                    Add
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {policyTypes.map((policyType) => (
                    <span key={policyType} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 border border-slate-200">{policyType}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="col-span-12 lg:col-span-5 rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-xl font-semibold text-green-950">Users</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {users.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="font-medium text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#1b5e20]">{user.role}</div>
                    <div className="text-xs text-slate-400">{user.dealerCode}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="col-span-12 lg:col-span-7 rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-xl font-semibold text-green-950">Recent Audit Trail</h2>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((event: any, index) => (
                    <tr key={event.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-4 py-3 font-mono text-xs">{new Date(event.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{event.module}</td>
                      <td className="px-4 py-3 font-medium">{event.action}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{event.refId ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
