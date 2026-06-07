import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PurchaseInvoices from './pages/PurchaseInvoices'
import PDIManagement from './pages/PDIManagement'
import InstallationCertificate from './pages/InstallationCertificate'
import CustomerDelivery from './pages/CustomerDelivery'
import Exchange from './pages/Exchange'
import SafetyMaintenance from './pages/SafetyMaintenance'
import Insurance from './pages/Insurance'
import RTODocuments from './pages/RTODocuments'
import Accounts from './pages/Accounts'
import ATSChargeSheet from './pages/ATSChargeSheet'
import ServiceManagement from './pages/ServiceManagement'
import AdminPanel from './pages/AdminPanel'
import FieldServiceTablet from './pages/FieldServiceTablet'
import SearchResults from './pages/SearchResults'
import VehicleFlowTracker from './pages/VehicleFlowTracker'
import Profile from './pages/Profile'
import GuidedFlow from './pages/GuidedFlow'
import SafetyDosDonts from './pages/SafetyDosDonts'
import SafetyMaintenanceGuide from './pages/SafetyMaintenanceGuide'
import { useAuthStore } from './store/auth.store'
import { canAccess } from './lib/rbac'

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuthStore()
  return isAuthenticated && token ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function ProtectedRoute({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  const { isAuthenticated, user, token, clearAuth } = useAuthStore()
  if (!token) {
    clearAuth()
    return <Navigate to="/login" replace />
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!canAccess(user?.role, moduleKey)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<ProtectedRoute moduleKey="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/purchase-invoices" element={<ProtectedRoute moduleKey="purchase"><PurchaseInvoices /></ProtectedRoute>} />
        <Route path="/pdi" element={<ProtectedRoute moduleKey="pdi"><PDIManagement /></ProtectedRoute>} />
        <Route path="/installation" element={<ProtectedRoute moduleKey="installation"><InstallationCertificate /></ProtectedRoute>} />
        <Route path="/delivery" element={<ProtectedRoute moduleKey="delivery"><CustomerDelivery /></ProtectedRoute>} />
        <Route path="/exchange" element={<ProtectedRoute moduleKey="exchange"><Exchange /></ProtectedRoute>} />
        <Route path="/safety" element={<ProtectedRoute moduleKey="safety"><SafetyMaintenance /></ProtectedRoute>} />
        <Route path="/safety/dos-donts" element={<ProtectedRoute moduleKey="safety"><SafetyDosDonts /></ProtectedRoute>} />
        <Route path="/safety/maintenance-guide" element={<ProtectedRoute moduleKey="safety"><SafetyMaintenanceGuide /></ProtectedRoute>} />
        <Route path="/insurance" element={<ProtectedRoute moduleKey="insurance"><Insurance /></ProtectedRoute>} />
        <Route path="/rto" element={<ProtectedRoute moduleKey="rto"><RTODocuments /></ProtectedRoute>} />
        <Route path="/accounts" element={<ProtectedRoute moduleKey="accounts"><Accounts /></ProtectedRoute>} />
        <Route path="/ats" element={<ProtectedRoute moduleKey="ats"><ATSChargeSheet /></ProtectedRoute>} />
        <Route path="/service" element={<ProtectedRoute moduleKey="service"><ServiceManagement /></ProtectedRoute>} />
        <Route path="/field-service" element={<ProtectedRoute moduleKey="fieldService"><FieldServiceTablet /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute moduleKey="admin"><AdminPanel /></ProtectedRoute>} />
        <Route path="/search/:query" element={<SearchResults />} />
        <Route path="/vehicle-flow/:vehicleId" element={<ProtectedRoute moduleKey="dashboard"><VehicleFlowTracker /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute moduleKey="profile"><Profile /></ProtectedRoute>} />
        <Route path="/guided-flow" element={<ProtectedRoute moduleKey="dashboard"><GuidedFlow /></ProtectedRoute>} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
