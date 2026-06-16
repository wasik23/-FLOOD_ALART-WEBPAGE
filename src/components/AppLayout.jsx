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
    <div className="flex min-h-screen flex-col bg-[#080d0d] text-slate-100">
      <BrandHeader>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 transition',
                isActive
                  ? 'text-emerald-300 underline decoration-emerald-300 underline-offset-8'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
        <span className="max-w-[220px] truncate rounded-md border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-slate-300">
          {user.email}
        </span>
        <button
          aria-label={t('app.language')}
          className="rounded-md border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/[0.06]"
          onClick={toggleLanguage}
          type="button"
        >
          {i18n.language === 'bn-BD' ? t('app.english') : t('app.bangla')}
        </button>
        <button
          className="rounded-md border border-red-300/20 bg-red-300/10 px-3 py-2 text-red-100 hover:bg-red-300/15"
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
