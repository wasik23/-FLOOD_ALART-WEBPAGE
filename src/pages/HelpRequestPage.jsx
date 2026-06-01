import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandHeader from '../components/BrandHeader.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import { districtUpazilas, districts } from '../data/upazilas.js'
import { createHelpRequest } from '../data/reliefData.js'

const needTypes = ['Rescue', 'Food', 'Medicine', 'Shelter', 'Clean water', 'Other']

function HelpRequestPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    district: '',
    upazila: '',
    address: '',
    needType: 'Rescue',
    peopleCount: '',
    notes: '',
  })
  const [confirmation, setConfirmation] = useState(null)

  const upazilaOptions = useMemo(
    () => (form.district ? districtUpazilas[form.district] ?? [] : []),
    [form.district],
  )

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) =>
      name === 'district'
        ? { ...current, district: value, upazila: '' }
        : { ...current, [name]: value },
    )
  }

  const submitRequest = (event) => {
    event.preventDefault()
    const request = createHelpRequest({
      ...form,
      peopleCount: Number(form.peopleCount) || 1,
    })
    setConfirmation(request)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <BrandHeader>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/">
          Home
        </Link>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/alerts">
          SMS alerts
        </Link>
        <Link className="rounded-md bg-white px-3 py-2 text-sky-800" to="/donate">
          Donate now
        </Link>
      </BrandHeader>

      <main className="page-shell">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Request help
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950">
            Tell relief teams what support is needed.
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            No account is required. NGO coordinators and admins can review these
            requests from their protected records page.
          </p>

          {confirmation ? (
            <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
                Request submitted
              </p>
              <h2 className="mt-2 text-2xl font-bold text-green-950">
                Reference: {confirmation.id}
              </h2>
              <p className="mt-3 leading-7 text-green-900">
                Your request is saved as pending. Keep your phone reachable for
                coordinator follow-up.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link className="button-primary" to="/">
                  Back home
                </Link>
                <button
                  className="button-secondary bg-white"
                  onClick={() => setConfirmation(null)}
                  type="button"
                >
                  Submit another
                </button>
              </div>
            </div>
          ) : (
            <form
              className="mt-8 grid gap-5 rounded-lg border border-primary-100 bg-white p-6 shadow-soft"
              onSubmit={submitRequest}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label className="form-label">
                  Name
                  <input
                    className="form-input"
                    name="name"
                    onChange={updateField}
                    required
                    value={form.name}
                  />
                </label>
                <label className="form-label">
                  Phone number
                  <input
                    autoComplete="tel"
                    className="form-input"
                    inputMode="tel"
                    name="phone"
                    onChange={updateField}
                    required
                    value={form.phone}
                  />
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="form-label">
                  District
                  <select
                    className="form-input"
                    name="district"
                    onChange={updateField}
                    required
                    value={form.district}
                  >
                    <option value="">Select district</option>
                    {districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Upazila
                  <select
                    className="form-input"
                    disabled={!form.district}
                    name="upazila"
                    onChange={updateField}
                    required
                    value={form.upazila}
                  >
                    <option value="">
                      {form.district ? 'Select upazila' : 'Select district first'}
                    </option>
                    {upazilaOptions.map((upazila) => (
                      <option key={upazila} value={upazila}>
                        {upazila}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="form-label">
                Exact address or landmark
                <textarea
                  className="form-input min-h-[96px] resize-y"
                  name="address"
                  onChange={updateField}
                  required
                  value={form.address}
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="form-label">
                  Need type
                  <select
                    className="form-input"
                    name="needType"
                    onChange={updateField}
                    value={form.needType}
                  >
                    {needTypes.map((needType) => (
                      <option key={needType} value={needType}>
                        {needType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  People affected
                  <input
                    className="form-input"
                    min="1"
                    name="peopleCount"
                    onChange={updateField}
                    required
                    type="number"
                    value={form.peopleCount}
                  />
                </label>
              </div>

              <label className="form-label">
                Situation details
                <textarea
                  className="form-input min-h-[120px] resize-y"
                  name="notes"
                  onChange={updateField}
                  placeholder="Describe water level, urgent risks, people stranded, or medical needs."
                  value={form.notes}
                />
              </label>

              <button className="button-primary w-full" type="submit">
                Submit help request
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default HelpRequestPage
