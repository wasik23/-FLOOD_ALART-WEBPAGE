import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROLE_HOME_PATHS, ROLE_OPTIONS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import SiteFooter from '../components/SiteFooter.jsx'

const demoAccounts = [
  'public@example.com',
  'volunteer@example.com',
  'coordinator@example.com',
  'admin@example.com',
]

function AuthForm({ mode }) {
  const { t } = useTranslation()
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login, register, user } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES.PUBLIC,
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fallbackPath = user ? ROLE_HOME_PATHS[user.role] : '/dashboard'
  const actionLabel = useMemo(() => {
    if (isSubmitting) {
      return isRegister ? t('auth.creating') : t('auth.signingIn')
    }

    return isRegister ? t('auth.createAccount') : t('auth.signIn')
  }, [isRegister, isSubmitting, t])

  if (isAuthenticated) {
    return <Navigate to={fallbackPath} replace />
  }

  const updateField = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const nextSession = isRegister
        ? await register(form)
        : await login({
            email: form.email,
            password: form.password,
            role: form.role,
          })

      navigate(location.state?.from?.pathname ?? ROLE_HOME_PATHS[nextSession.user.role], {
        replace: true,
      })
    } catch (authError) {
      setError(authError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t('auth.eyebrow')}
            </p>
            <h1 id="auth-title" className="mt-3 text-4xl font-bold text-slate-950">
              {isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-600">
              {t('auth.intro')}
            </p>
          </div>

          <form className="mt-8 grid gap-5" onSubmit={submitForm}>
            {isRegister ? (
              <label className="form-label">
                {t('auth.fullName')}
                <input
                  autoComplete="name"
                  className="form-input"
                  name="name"
                  onChange={updateField}
                  required
                  type="text"
                  value={form.name}
                />
              </label>
            ) : null}

            <label className="form-label">
              {t('auth.email')}
              <input
                autoComplete="email"
                className="form-input"
                name="email"
                onChange={updateField}
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="form-label">
              {t('auth.password')}
              <input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="form-input"
                minLength="6"
                name="password"
                onChange={updateField}
                required
                type="password"
                value={form.password}
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">
                {t('auth.role')}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {ROLE_OPTIONS.map((role) => (
                  <label className="role-option" key={role.value}>
                    <input
                      checked={form.role === role.value}
                      name="role"
                      onChange={updateField}
                      type="radio"
                      value={role.value}
                    />
                    <span>{t(`roles.${role.value}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <button className="button-primary w-full" disabled={isSubmitting} type="submit">
              {actionLabel}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            {isRegister ? t('auth.alreadyRegistered') : t('auth.needAccount')}{' '}
            <Link
              className="font-semibold text-primary"
              to={isRegister ? '/login' : '/register'}
            >
              {isRegister ? t('auth.signIn') : t('auth.register')}
            </Link>
          </p>
        </section>

        <aside className="mock-panel">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            {t('auth.mockUsers')}
          </p>
          <ul className="mt-4 grid gap-3">
            {demoAccounts.map((email) => (
              <li key={email}>
                <code className="rounded bg-primary-50 px-2 py-1 text-sm text-primary-800">
                  {email}
                </code>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate-600">
            {t('auth.seededPassword')} <strong>password</strong>
          </p>
        </aside>
      </main>
      <SiteFooter />
    </>
  )
}

AuthForm.propTypes = {
  mode: PropTypes.oneOf(['login', 'register']).isRequired,
}

export default AuthForm
