import { Navigate, Route, Routes } from 'react-router-dom'
import { ROLE_HOME_PATHS, ROLES } from './auth/roles.js'
import { useAuth } from './auth/useAuth.js'
import AppLayout from './components/AppLayout.jsx'
import GlobalWebsiteAlert from './components/GlobalWebsiteAlert.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AuthForm from './pages/AuthForm.jsx'
import CoordinatorDashboard from './pages/CoordinatorDashboard.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DonationPage from './pages/DonationPage.jsx'
import GetAlerts from './pages/GetAlerts.jsx'
import HelpRequestPage from './pages/HelpRequestPage.jsx'
import Home from './pages/Home.jsx'
import MapPage from './pages/MapPage.jsx'
import NotFound from './pages/NotFound.jsx'
import RecordsPage from './pages/RecordsPage.jsx'
import Shelters from './pages/Shelters.jsx'
import SituationReport from './pages/SituationReport.jsx'
import Unauthorized from './pages/Unauthorized.jsx'
import VolunteerCoordination from './pages/VolunteerCoordination.jsx'

function RoleHomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={ROLE_HOME_PATHS[user.role] || '/'} replace />
}

function App() {
  return (
    <>
      <GlobalWebsiteAlert />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthForm mode="login" role={ROLES.VOLUNTEER} />} />
        <Route path="/register" element={<AuthForm mode="register" role={ROLES.VOLUNTEER} />} />
        <Route path="/ngo" element={<AuthForm mode="login" role={ROLES.NGO} />} />
        <Route path="/admin" element={<AuthForm mode="login" role={ROLES.ADMIN} />} />
        <Route path="/alerts" element={<GetAlerts />} />
        <Route path="/donate" element={<DonationPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/request-help" element={<HelpRequestPage />} />

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

        <Route element={<ProtectedRoute allowedRoles={[ROLES.VOLUNTEER]} />}>
          <Route element={<AppLayout />}>
            <Route path="/volunteer" element={<VolunteerCoordination />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.NGO]} />}>
          <Route element={<AppLayout />}>
            <Route path="/coordinator" element={<CoordinatorDashboard />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route
          element={<ProtectedRoute allowedRoles={[ROLES.NGO, ROLES.ADMIN]} />}
        >
          <Route element={<AppLayout />}>
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/situation-report" element={<SituationReport />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<RoleHomeRedirect />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
