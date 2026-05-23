import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SiteFooter from '../components/SiteFooter.jsx'
import { districtUpazilas, districts } from '../data/upazilas.js'

const phonePattern = /^(?:\+?88)?01[3-9]\d{8}$/

function normalisePhone(input) {
  const trimmed = input.replace(/\s|-/g, '')
  if (trimmed.startsWith('+88')) return trimmed.slice(1)
  if (trimmed.startsWith('88')) return trimmed
  if (trimmed.startsWith('0')) return `88${trimmed}`
  return trimmed
}

function GetAlerts() {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    phone: '',
    district: '',
    upazila: '',
    name: '',
  })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  const upazilaOptions = useMemo(
    () => (form.district ? districtUpazilas[form.district] ?? [] : []),
    [form.district],
  )

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => {
      if (name === 'district') {
        return { ...current, district: value, upazila: '' }
      }
      return { ...current, [name]: value }
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    if (!phonePattern.test(form.phone.replace(/\s|-/g, ''))) {
      setError(t('publicAlerts.invalidPhone'))
      return
    }
    if (!form.district) {
      setError(t('publicAlerts.districtRequired'))
      return
    }
    if (!form.upazila) {
      setError(t('publicAlerts.upazilaRequired'))
      return
    }

    setStatus('submitting')
    try {
      const response = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalisePhone(form.phone),
          district: form.district,
          upazila: form.upazila,
          name: form.name.trim() || undefined,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || t('publicAlerts.failed'))
      }

      setConfirmation(payload.subscription)
      setStatus('success')
    } catch (subscribeError) {
      setError(subscribeError.message)
      setStatus('idle')
    }
  }

  const resetForm = () => {
    setForm({ phone: '', district: '', upazila: '', name: '' })
    setConfirmation(null)
    setStatus('idle')
    setError('')
  }

  if (status === 'success' && confirmation) {
    return (
      <>
      <main className="page-shell">
        <div className="mx-auto max-w-xl rounded-lg border border-primary-100 bg-white p-8 shadow-soft">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-green-100 text-green-700">
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                {t('publicAlerts.subscribed')}
              </p>
              <h1 className="text-2xl font-bold text-slate-950">
                {t('publicAlerts.successTitle')}
              </h1>
            </div>
          </div>

          <dl className="grid gap-4">
            <div className="rounded-md bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('publicAlerts.phoneLabel')}
              </dt>
              <dd className="mt-1 font-semibold text-slate-950">
                +{confirmation.phone}
              </dd>
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('publicAlerts.locationLabel')}
              </dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {confirmation.upazila}, {confirmation.district}
              </dd>
            </div>
            {confirmation.confirmationSms ? (
              <div className="rounded-md border border-primary-100 bg-primary-50 p-4 text-sm text-primary-900">
                {t('publicAlerts.smsSent')}
              </div>
            ) : (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                {t('publicAlerts.smsDelayed')}
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="button-primary" onClick={resetForm} type="button">
              {t('publicAlerts.another')}
            </button>
            <Link className="button-secondary" to="/dashboard">
              {t('publicAlerts.back')}
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
      </>
    )
  }

  return (
    <>
    <main className="page-shell">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          {t('publicAlerts.eyebrow')}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          {t('publicAlerts.title')}
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          {t('publicAlerts.intro')}
        </p>

        <form
          className="mt-8 grid gap-5 rounded-lg border border-primary-100 bg-white p-6 shadow-soft"
          onSubmit={submit}
        >
          <label className="form-label">
            {t('publicAlerts.phone')}
            <input
              autoComplete="tel"
              className="form-input"
              inputMode="tel"
              name="phone"
              onChange={updateField}
              placeholder="01712345678"
              required
              type="tel"
              value={form.phone}
            />
            <span className="text-xs font-normal text-slate-500">
              {t('publicAlerts.phoneHelp')}
            </span>
          </label>

          <label className="form-label">
            {t('publicAlerts.name')}
            <input
              autoComplete="name"
              className="form-input"
              name="name"
              onChange={updateField}
              type="text"
              value={form.name}
            />
          </label>

          <label className="form-label">
            {t('publicAlerts.district')}
            <select
              className="form-input"
              name="district"
              onChange={updateField}
              required
              value={form.district}
            >
              <option value="">{t('publicAlerts.selectDistrict')}</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label">
            {t('publicAlerts.upazila')}
            <select
              className="form-input"
              disabled={!form.district}
              name="upazila"
              onChange={updateField}
              required
              value={form.upazila}
            >
              <option value="">
                {form.district
                  ? t('publicAlerts.selectUpazila')
                  : t('publicAlerts.selectDistrictFirst')}
              </option>
              {upazilaOptions.map((upazila) => (
                <option key={upazila} value={upazila}>
                  {upazila}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="button-primary w-full"
            disabled={status === 'submitting'}
            type="submit"
          >
            {status === 'submitting'
              ? t('publicAlerts.subscribing')
              : t('publicAlerts.subscribe')}
          </button>

          <p className="text-xs text-slate-500">
            {t('publicAlerts.consent')}
          </p>
        </form>
      </div>
    </main>
    <SiteFooter />
    </>
  )
}

export default GetAlerts
