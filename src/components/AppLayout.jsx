import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROLE_HOME_PATHS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import BrandHeader from './BrandHeader.jsx'
import SiteFooter from './SiteFooter.jsx'

const getNavItems = (role, t) => {
  const items = [
    {
      to: ROLE_HOME_PATHS[role],
      label: role === ROLES.NGO ? 'Triage' : t('nav.myProfile'),
    },
    { to: '/shelters', label: t('nav.shelters') },
    { to: '/map', label: t('nav.map') },
    { to: '/alerts', label: t('publicAlerts.title') },
  ]

  if (role === ROLES.ADMIN) {
    items.unshift({ to: '/dashboard', label: t('nav.dashboard') })
  }

  if (role === ROLES.NGO || role === ROLES.ADMIN) {
    items.push({ to: '/records', label: 'Records' })
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
    navigate('/', { replace: true })
  }

  const toggleLanguage = () => {
    i18n.changeLanguage(nextLanguage)
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary-50 text-slate-900">
      <BrandHeader>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 transition',
                isActive ? 'bg-white text-sky-800' : 'text-white/90 hover:bg-white/10',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
        <span className="max-w-[220px] truncate rounded-md bg-sky-900/40 px-3 py-2">
          {user.email}
        </span>
        <button
          aria-label={t('app.language')}
          className="rounded-md border border-white/40 px-3 py-2 text-white hover:bg-white/10"
          onClick={toggleLanguage}
          type="button"
        >
          {i18n.language === 'bn-BD' ? t('app.english') : t('app.bangla')}
        </button>
        <button
          className="rounded-md border border-white/40 px-3 py-2 text-white hover:bg-white/10"
          onClick={signOut}
          type="button"
        >
          {t('nav.signOut')}
        </button>
      </BrandHeader>

      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export default AppLayout
