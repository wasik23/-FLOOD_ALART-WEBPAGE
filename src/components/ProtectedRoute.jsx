import PropTypes from 'prop-types'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth.js'

function ProtectedRoute({ allowedRoles }) {
  const { t } = useTranslation()
  const { isAuthenticated, isReady, user } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return (
      <div className="page-shell text-sm font-semibold">
        {t('auth.checkingSession')}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

ProtectedRoute.propTypes = {
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
}

ProtectedRoute.defaultProps = {
  allowedRoles: [],
}

export default ProtectedRoute
