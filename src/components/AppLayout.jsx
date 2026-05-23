import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROLE_HOME_PATHS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import SiteFooter from './SiteFooter.jsx'

const getNavItems = (role, t) => {
  const items = [
    { to: ROLE_HOME_PATHS[role], label: t('nav.myProfile') },
    { to: '/shelters', label: t('nav.shelters') },
    { to: '/map', label: t('nav.map') },
    { to: '/alerts', label: t('publicAlerts.title') },
  ]

  if (role === ROLES.ADMIN) {
    items.unshift({ to: '/dashboard', label: t('nav.dashboard') })
  }

  if (role === ROLES.NGO || role === ROLES.ADMIN) {
    items.push({ to: '/situation-report', label: t('situation.title') })
  }

  return items
}

function AppLayout() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const navItems = getNavItems(user.role, t)
  const nextLanguage = i18n.language === 'bn-BD' ? 'en' : 'bn-BD'

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const toggleLanguage = () => {
    i18n.changeLanguage(nextLanguage)
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary-50 text-slate-900">
      <header className="border-b border-primary-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <NavLink to="/dashboard" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary">
              <span className="h-4 w-4 rounded-full bg-accent" />
            </span>
              <span>
              <span className="block text-sm font-semibold uppercase tracking-wide text-primary">
                {t('app.country')}
              </span>
              <span className="block text-lg font-bold leading-tight">
                {t('app.name')}
              </span>
            </span>
          </NavLink>

          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'rounded-md px-3 py-2 text-sm font-semibold transition',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-slate-700 hover:bg-primary-50 hover:text-primary',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <span className="max-w-[220px] truncate text-sm font-semibold text-slate-600">
              {user.email}
            </span>
            <button
              aria-label={t('app.language')}
              className="button-secondary min-w-[88px]"
              onClick={toggleLanguage}
              type="button"
            >
              {i18n.language === 'bn-BD' ? t('app.english') : t('app.bangla')}
            </button>
            <button className="button-secondary" onClick={signOut} type="button">
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export default AppLayout
