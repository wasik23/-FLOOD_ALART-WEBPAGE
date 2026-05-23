import { Navigate, Route, Routes } from 'react-router-dom'
import { ROLE_HOME_PATHS, ROLES } from './auth/roles.js'
import { useAuth } from './auth/useAuth.js'
import AppLayout from './components/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AuthForm from './pages/AuthForm.jsx'
import Dashboard from './pages/Dashboard.jsx'
import GetAlerts from './pages/GetAlerts.jsx'
import MapPage from './pages/MapPage.jsx'
import NotFound from './pages/NotFound.jsx'
import RolePage from './pages/RolePage.jsx'
import Shelters from './pages/Shelters.jsx'
import SituationReport from './pages/SituationReport.jsx'
import Unauthorized from './pages/Unauthorized.jsx'
import VolunteerCoordination from './pages/VolunteerCoordination.jsx'

function RoleRedirect() {
  const { isAuthenticated, isReady, user } = useAuth()

  if (!isReady) {
    return <div className="page-shell text-sm font-semibold">Checking session...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={ROLE_HOME_PATHS[user.role]} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<AuthForm mode="login" />} />
      <Route path="/register" element={<AuthForm mode="register" />} />
      <Route path="/alerts" element={<GetAlerts />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/shelters" element={<Shelters />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.PUBLIC]} />}>
        <Route element={<AppLayout />}>
          <Route path="/public" element={<RolePage role={ROLES.PUBLIC} />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.VOLUNTEER]} />}>
        <Route element={<AppLayout />}>
          <Route path="/volunteer" element={<VolunteerCoordination />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.NGO]} />}>
        <Route element={<AppLayout />}>
          <Route path="/coordinator" element={<RolePage role={ROLES.NGO} />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>

      <Route
        element={<ProtectedRoute allowedRoles={[ROLES.NGO, ROLES.ADMIN]} />}
      >
        <Route element={<AppLayout />}>
          <Route path="/situation-report" element={<SituationReport />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/map" element={<MapPage />} />
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
