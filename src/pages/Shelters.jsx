import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { initialShelters } from '../data/shelters.js'

const statusStyles = {
  Open: 'bg-emerald-100 text-emerald-800',
  Full: 'bg-amber-100 text-amber-800',
  Closed: 'bg-slate-200 text-slate-700',
}

const defaultForm = {
  name: '',
  upazila: '',
  district: '',
  occupied: '0',
  capacity: '',
  contact: '',
  status: 'Open',
  resources: ['food', 'water'],
}

function ShelterCard({ shelter, t }) {
  const usage = Math.min(
    100,
    Math.round((shelter.occupied / Math.max(shelter.capacity, 1)) * 100),
  )

  return (
    <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{shelter.name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {shelter.upazila}, {shelter.district}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-3 py-1 text-xs font-bold ${statusStyles[shelter.status]}`}
        >
          {t(`shelters.statuses.${shelter.status}`)}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className="text-slate-700">{t('shelters.currentCapacity')}</span>
          <span className="text-slate-950">
            {shelter.occupied}/{shelter.capacity}
          </span>
        </div>
        <div
          aria-label={t('shelters.capacityUsed', { usage })}
          className="mt-2 h-3 overflow-hidden rounded-full bg-primary-50"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={usage}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${usage}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {shelter.resources.map((resource) => (
          <span
            className="rounded-md bg-primary-50 px-3 py-1 text-xs font-bold text-primary-800"
            key={resource}
          >
            {t(`shelters.resourcesList.${resource}`)}
          </span>
        ))}
      </div>

      <div className="mt-5 border-t border-primary-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {t('shelters.contact')}
        </p>
        <a
          className="mt-1 block font-semibold text-primary hover:text-primary-700"
          href={`tel:${shelter.contact.replace(/[^+\d]/g, '')}`}
        >
          {shelter.contact}
        </a>
      </div>
    </article>
  )
}

function AddShelterModal({ form, onChange, onClose, onSubmit, onToggleResource, t }) {
  const resourceLabels = ['food', 'water', 'medical']

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4 py-6"
      role="dialog"
    >
      <form
        className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-soft"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t('shelters.registry')}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {t('shelters.add')}
            </h2>
          </div>
          <button
            className="button-secondary px-3"
            onClick={onClose}
            type="button"
          >
            {t('shelters.close')}
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="form-label sm:col-span-2">
            {t('shelters.shelterName')}
            <input
              className="form-input"
              name="name"
              onChange={onChange}
              required
              value={form.name}
            />
          </label>
          <label className="form-label">
            {t('shelters.upazila')}
            <input
              className="form-input"
              name="upazila"
              onChange={onChange}
              required
              value={form.upazila}
            />
          </label>
          <label className="form-label">
            {t('shelters.district')}
            <input
              className="form-input"
              name="district"
              onChange={onChange}
              required
              value={form.district}
            />
          </label>
          <label className="form-label">
            {t('shelters.occupied')}
            <input
              className="form-input"
              min="0"
              name="occupied"
              onChange={onChange}
              required
              type="number"
              value={form.occupied}
            />
          </label>
          <label className="form-label">
            {t('shelters.capacity')}
            <input
              className="form-input"
              min="1"
              name="capacity"
              onChange={onChange}
              required
              type="number"
              value={form.capacity}
            />
          </label>
          <label className="form-label">
            {t('shelters.contactNumber')}
            <input
              className="form-input"
              name="contact"
              onChange={onChange}
              required
              type="tel"
              value={form.contact}
            />
          </label>
          <label className="form-label">
            {t('shelters.status')}
            <select
              className="form-input"
              name="status"
              onChange={onChange}
              value={form.status}
            >
              <option value="Open">{t('shelters.statuses.Open')}</option>
              <option value="Full">{t('shelters.statuses.Full')}</option>
              <option value="Closed">{t('shelters.statuses.Closed')}</option>
            </select>
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-slate-800">
            {t('shelters.resources')}
          </legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {resourceLabels.map((value) => (
              <label className="role-option" key={value}>
                <input
                  checked={form.resources.includes(value)}
                  onChange={() => onToggleResource(value)}
                  type="checkbox"
                />
                {t(`shelters.resourcesList.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="button-secondary" onClick={onClose} type="button">
            {t('shelters.cancel')}
          </button>
          <button className="button-primary" type="submit">
            {t('shelters.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Shelters() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [shelters, setShelters] = useState(initialShelters)
  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState('All')
  const [status, setStatus] = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)

  const canAddShelter = [ROLES.NGO, ROLES.ADMIN].includes(user.role)

  const districts = useMemo(
    () => ['All', ...new Set(shelters.map((shelter) => shelter.district).sort())],
    [shelters],
  )

  const filteredShelters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return shelters.filter((shelter) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [shelter.name, shelter.upazila, shelter.district, shelter.contact]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      const matchesDistrict = district === 'All' || shelter.district === district
      const matchesStatus = status === 'All' || shelter.status === status

      return matchesQuery && matchesDistrict && matchesStatus
    })
  }, [district, query, shelters, status])

  const totals = useMemo(
    () =>
      shelters.reduce(
        (summary, shelter) => ({
          capacity: summary.capacity + shelter.capacity,
          occupied: summary.occupied + shelter.occupied,
          open: summary.open + (shelter.status === 'Open' ? 1 : 0),
        }),
        { capacity: 0, occupied: 0, open: 0 },
      ),
    [shelters],
  )

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const toggleResource = (resource) => {
    setForm((current) => {
      const resources = current.resources.includes(resource)
        ? current.resources.filter((item) => item !== resource)
        : [...current.resources, resource]

      return { ...current, resources }
    })
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setForm(defaultForm)
  }

  const addShelter = (event) => {
    event.preventDefault()

    const capacity = Number(form.capacity)
    const occupied = Math.min(Number(form.occupied), capacity)

    setShelters((current) => [
      {
        id: `shelter-${Date.now()}`,
        name: form.name.trim(),
        upazila: form.upazila.trim(),
        district: form.district.trim(),
        occupied,
        capacity,
        resources: form.resources.length > 0 ? form.resources : ['water'],
        contact: form.contact.trim(),
        status: form.status,
      },
      ...current,
    ])
    closeModal()
  }

  return (
    <section className="page-shell">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('shelters.eyebrow')}
          </p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">
            {t('shelters.title')}
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            {t('shelters.intro')}
          </p>
        </div>
        {canAddShelter ? (
          <button
            className="button-primary self-start md:self-auto"
            onClick={() => setIsModalOpen(true)}
            type="button"
          >
            {t('shelters.add')}
          </button>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-primary-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('shelters.openShelters')}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{totals.open}</p>
        </article>
        <article className="rounded-lg border border-primary-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('shelters.occupancy')}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {totals.occupied}
          </p>
        </article>
        <article className="rounded-lg border border-primary-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('shelters.totalCapacity')}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {totals.capacity}
          </p>
        </article>
      </div>

      <div className="mt-8 grid gap-4 rounded-lg border border-primary-100 bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
        <label className="form-label">
          {t('shelters.search')}
          <input
            className="form-input"
            onChange={(event) => setQuery(event.target.value)}
            value={query}
          />
        </label>
        <label className="form-label">
          {t('shelters.district')}
          <select
            className="form-input"
            onChange={(event) => setDistrict(event.target.value)}
            value={district}
          >
            {districts.map((item) => (
              <option key={item} value={item}>
                {item === 'All' ? t('shelters.all') : item}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          {t('shelters.status')}
          <select
            className="form-input"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="All">{t('shelters.all')}</option>
            <option value="Open">{t('shelters.statuses.Open')}</option>
            <option value="Full">{t('shelters.statuses.Full')}</option>
            <option value="Closed">{t('shelters.statuses.Closed')}</option>
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {filteredShelters.map((shelter) => (
          <ShelterCard key={shelter.id} shelter={shelter} t={t} />
        ))}
      </div>

      {filteredShelters.length === 0 ? (
        <div className="mt-6 rounded-lg border border-primary-100 bg-white p-8 text-center">
          <p className="text-lg font-bold text-slate-950">
            {t('shelters.noResults')}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {t('shelters.adjustFilters')}
          </p>
        </div>
      ) : null}

      {isModalOpen ? (
        <AddShelterModal
          form={form}
          onChange={handleFormChange}
          onClose={closeModal}
          onSubmit={addShelter}
          onToggleResource={toggleResource}
          t={t}
        />
      ) : null}
    </section>
  )
}

ShelterCard.propTypes = {
  shelter: PropTypes.shape({
    capacity: PropTypes.number.isRequired,
    contact: PropTypes.string.isRequired,
    district: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    occupied: PropTypes.number.isRequired,
    resources: PropTypes.arrayOf(PropTypes.string).isRequired,
    status: PropTypes.string.isRequired,
    upazila: PropTypes.string.isRequired,
  }).isRequired,
  t: PropTypes.func.isRequired,
}

AddShelterModal.propTypes = {
  form: PropTypes.shape({
    capacity: PropTypes.string.isRequired,
    contact: PropTypes.string.isRequired,
    district: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    occupied: PropTypes.string.isRequired,
    resources: PropTypes.arrayOf(PropTypes.string).isRequired,
    status: PropTypes.string.isRequired,
    upazila: PropTypes.string.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onToggleResource: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}

export default Shelters
