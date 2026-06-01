import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth.js'

function RolePage({ role }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const roleLabel = t(`roles.${role}`)
  const tasks = t(`rolePage.tasks.${role}`, { returnObjects: true })

  return (
    <section className="page-shell">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          {t('rolePage.eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">
          {t('rolePage.title', { role: roleLabel })}
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          {t('rolePage.intro', { role: roleLabel })}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold text-slate-950">
            {t('rolePage.session')}
          </h2>
          <dl className="mt-5 grid gap-4">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {t('rolePage.name')}
              </dt>
              <dd className="mt-1 font-semibold text-slate-950">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {t('rolePage.email')}
              </dt>
              <dd className="mt-1 font-semibold text-slate-950">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {t('rolePage.role')}
              </dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {t(`roles.${user.role}`)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold text-slate-950">
            {t('rolePage.actions')}
          </h2>
          <ul className="mt-5 grid gap-3">
            {tasks.map((task) => (
              <li
                className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-900"
                key={task}
              >
                {task}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

RolePage.propTypes = {
  role: PropTypes.string.isRequired,
}

export default RolePage
