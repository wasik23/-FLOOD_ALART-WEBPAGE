import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function Unauthorized() {
  const { t } = useTranslation()

  return (
    <section className="page-shell">
      <div className="rounded-lg border border-primary-100 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {t('errors.unauthorizedEyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          {t('errors.unauthorizedTitle')}
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          {t('errors.unauthorizedBody')}
        </p>
        <Link to="/dashboard" className="button-primary mt-6">
          {t('errors.back')}
        </Link>
      </div>
    </section>
  )
}

export default Unauthorized
