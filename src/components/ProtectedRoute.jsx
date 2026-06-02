import PropTypes from 'prop-types'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth.js'
import { ROLES } from '../auth/roles.js'

function getLoginPath(allowedRoles) {
  if (allowedRoles.length === 1 && allowedRoles[0] === ROLES.ADMIN) {
    return '/admin'
  }

  if (allowedRoles.length === 1 && allowedRoles[0] === ROLES.NGO) {
    return '/ngo'
  }

  return '/login'
}

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
    return <Navigate to={getLoginPath(allowedRoles)} replace state={{ from: location }} />
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
