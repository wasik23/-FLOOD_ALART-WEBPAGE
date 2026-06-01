import { useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { getVolunteerProfiles, upsertVolunteerProfile } from '../data/reliefData.js'

const ADMIN_USER_OPS_KEY = 'admin_user_ops'

const skills = [
  { value: 'boat', label: 'Boat' },
  { value: 'medical', label: 'Medical' },
  { value: 'food', label: 'Food' },
  { value: 'rescue', label: 'Rescue' },
]

const availabilityOptions = ['Available', 'Busy', 'Offline']
const progressOptions = ['Started', 'Reached location', 'Need backup', 'Completed']

const initialTasks = [
  {
    id: 1,
    location: 'Sylhet Sadar',
    resource: 'Rescue boat and flotation vests',
    skill: 'boat',
    urgency: 'High',
    status: 'open',
  },
  {
    id: 2,
    location: 'Sunamganj',
    resource: 'Medical triage team',
    skill: 'medical',
    urgency: 'Critical',
    status: 'open',
  },
  {
    id: 3,
    location: 'Kurigram',
    resource: 'Dry food packets',
    skill: 'food',
    urgency: 'Medium',
    status: 'accepted',
  },
  {
    id: 4,
    location: 'Netrokona',
    resource: 'Evacuation support',
    skill: 'rescue',
    urgency: 'High',
    status: 'completed',
  },
  {
    id: 5,
    location: 'Feni',
    resource: 'Clean water distribution',
    skill: 'food',
    urgency: 'Medium',
    status: 'open',
  },
]

const columns = [
  { key: 'open', title: 'Open' },
  { key: 'accepted', title: 'Accepted' },
  { key: 'completed', title: 'Completed' },
]

const urgencyStyles = {
  Critical: 'bg-accent-50 text-accent-700 ring-accent-100',
  High: 'bg-amber-50 text-amber-700 ring-amber-100',
  Medium: 'bg-sky-50 text-sky-700 ring-sky-100',
}

const availabilityStyles = {
  Available: 'bg-green-100 text-green-800',
  Busy: 'bg-amber-100 text-amber-800',
  Offline: 'bg-slate-200 text-slate-700',
}

function readJson(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

function VolunteerCoordination() {
  const { user } = useAuth()
  const savedProfile = getVolunteerProfiles().find((profile) => profile.userId === user.id)
  const adminOperations = readJson(ADMIN_USER_OPS_KEY, {})
  const isVerified = adminOperations[user.id]?.verified ?? false
  const [volunteer, setVolunteer] = useState({
    name: savedProfile?.name || user.name || '',
    imageData: savedProfile?.imageData || '',
    phone: savedProfile?.phone || '',
    address: savedProfile?.address || '',
    guardianPhone: savedProfile?.guardianPhone || '',
    location: savedProfile?.location || '',
    skills: savedProfile?.skills || [],
    availability: savedProfile?.availability || 'Available',
    fieldReports: savedProfile?.fieldReports || [],
  })
  const [profileSaved, setProfileSaved] = useState(false)
  const [progressReport, setProgressReport] = useState({
    taskId: '',
    status: 'Started',
    notes: '',
  })
  const [tasks, setTasks] = useState(initialTasks)

  const tasksByStatus = useMemo(
    () =>
      columns.reduce((groupedTasks, column) => {
        groupedTasks[column.key] = tasks.filter((task) => task.status === column.key)
        return groupedTasks
      }, {}),
    [tasks],
  )

  const matchedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === 'open' &&
          (volunteer.skills.length === 0 || volunteer.skills.includes(task.skill)),
      ),
    [tasks, volunteer.skills],
  )

  const persistProfile = (nextVolunteer = volunteer) => {
    const profile = upsertVolunteerProfile({
      ...nextVolunteer,
      userId: user.id,
      email: user.email,
    })
    setProfileSaved(true)
    return profile
  }

  const updateField = (event) => {
    const { name, value } = event.target
    setProfileSaved(false)
    setVolunteer((current) => ({ ...current, [name]: value }))
  }

  const updateAvailability = (availability) => {
    setVolunteer((current) => {
      const nextVolunteer = { ...current, availability }
      persistProfile(nextVolunteer)
      return nextVolunteer
    })
  }

  const toggleSkill = (event) => {
    const { checked, value } = event.target
    setProfileSaved(false)
    setVolunteer((current) => ({
      ...current,
      skills: checked
        ? [...current.skills, value]
        : current.skills.filter((skill) => skill !== value),
    }))
  }

  const updateImage = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setProfileSaved(false)
      setVolunteer((current) => ({ ...current, imageData: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const saveProfile = (event) => {
    event.preventDefault()
    persistProfile()
  }

  const moveTask = (taskId, status) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, status } : task,
      ),
    )
  }

  const submitProgressReport = (event) => {
    event.preventDefault()
    const task = tasks.find((item) => String(item.id) === progressReport.taskId)

    if (!task) return

    const report = {
      id: `report_${Date.now()}`,
      taskId: task.id,
      taskLocation: task.location,
      status: progressReport.status,
      notes: progressReport.notes.trim(),
      createdAt: new Date().toISOString(),
    }

    setVolunteer((current) => {
      const nextVolunteer = {
        ...current,
        fieldReports: [report, ...(current.fieldReports || [])].slice(0, 8),
      }
      persistProfile(nextVolunteer)
      return nextVolunteer
    })

    if (progressReport.status === 'Completed') {
      moveTask(task.id, 'completed')
    }

    setProgressReport({ taskId: '', status: 'Started', notes: '' })
  }

  return (
    <section className="page-shell">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Volunteer workspace
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950">
          Field support and task coordination
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          This protected page is available only to signed-in volunteer accounts.
          Keep your profile current, manage availability, accept matched tasks,
          and report field progress.
        </p>
      </div>

      <div className="grid gap-6">
        <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {volunteer.imageData ? (
                <img
                  alt={volunteer.name}
                  className="h-24 w-24 rounded-lg object-cover"
                  src={volunteer.imageData}
                />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-lg bg-primary-50 text-sm font-bold text-primary">
                  Photo
                </span>
              )}
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-slate-950">
                  {volunteer.name || user.name}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {user.email}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                  <span
                    className={[
                      'rounded-md px-3 py-2',
                      isVerified
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800',
                    ].join(' ')}
                  >
                    {isVerified ? 'Verified volunteer' : 'Pending NGO/admin verification'}
                  </span>
                  <span
                    className={[
                      'rounded-md px-3 py-2',
                      availabilityStyles[volunteer.availability],
                    ].join(' ')}
                  >
                    {volunteer.availability}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-bold text-slate-700">
                Availability
              </p>
              <div className="grid grid-cols-3 gap-2">
                {availabilityOptions.map((availability) => (
                  <button
                    className={[
                      'rounded-md border px-3 py-3 text-sm font-bold transition',
                      volunteer.availability === availability
                        ? 'border-primary bg-primary text-white'
                        : 'border-primary-100 bg-primary-50 text-slate-700 hover:border-primary',
                    ].join(' ')}
                    key={availability}
                    onClick={() => updateAvailability(availability)}
                    type="button"
                  >
                    {availability}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Profile details
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Contact, location, and skills
              </h2>
            </div>
            {profileSaved ? (
              <span className="rounded-md bg-green-100 px-3 py-2 text-sm font-bold text-green-800">
                Profile saved
              </span>
            ) : null}
          </div>

          <form className="grid gap-5" onSubmit={saveProfile}>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="form-label">
                Full name
                <input
                  className="form-input"
                  name="name"
                  onChange={updateField}
                  required
                  type="text"
                  value={volunteer.name}
                />
              </label>
              <label className="form-label">
                Phone number
                <input
                  autoComplete="tel"
                  className="form-input"
                  name="phone"
                  onChange={updateField}
                  required
                  type="tel"
                  value={volunteer.phone}
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="form-label">
                Volunteer image
                <input
                  accept="image/*"
                  className="form-input"
                  onChange={updateImage}
                  type="file"
                />
              </label>
              <label className="form-label">
                Guardian phone
                <input
                  autoComplete="tel"
                  className="form-input"
                  name="guardianPhone"
                  onChange={updateField}
                  required
                  type="tel"
                  value={volunteer.guardianPhone}
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="form-label">
                Current work area
                <input
                  className="form-input"
                  name="location"
                  onChange={updateField}
                  placeholder="District or upazila"
                  required
                  type="text"
                  value={volunteer.location}
                />
              </label>
              <label className="form-label">
                Address
                <textarea
                  className="form-input min-h-[96px] resize-y"
                  name="address"
                  onChange={updateField}
                  required
                  value={volunteer.address}
                />
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-800">
                Skills
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {skills.map((skill) => (
                  <label className="role-option" key={skill.value}>
                    <input
                      checked={volunteer.skills.includes(skill.value)}
                      onChange={toggleSkill}
                      type="checkbox"
                      value={skill.value}
                    />
                    {skill.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="button-primary justify-self-start" type="submit">
              Save profile
            </button>
          </form>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Matched tasks
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Based on your saved skills
                </h2>
              </div>
              <span className="rounded-md bg-primary-50 px-3 py-2 text-sm font-bold text-primary">
                {matchedTasks.length} matches
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {matchedTasks.slice(0, 4).map((task) => (
                <article
                  className="rounded-md border border-primary-100 bg-slate-50 p-4"
                  key={task.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {task.skill}
                      </p>
                      <h3 className="mt-1 font-bold text-slate-950">
                        {task.location}
                      </h3>
                    </div>
                    <span
                      className={[
                        'rounded-full px-2.5 py-1 text-xs font-bold ring-1',
                        urgencyStyles[task.urgency],
                      ].join(' ')}
                    >
                      {task.urgency}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                    {task.resource}
                  </p>
                  <button
                    className="button-primary mt-4 w-full"
                    disabled={!isVerified || volunteer.availability !== 'Available'}
                    onClick={() => moveTask(task.id, 'accepted')}
                    type="button"
                  >
                    Accept matched task
                  </button>
                </article>
              ))}
              {matchedTasks.length === 0 ? (
                <div className="rounded-md border border-dashed border-primary-100 bg-primary-50 p-4 text-sm font-semibold text-primary md:col-span-2">
                  Add skills or check later for matching open tasks.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Field progress
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Submit task update
            </h2>
            <form className="mt-4 grid gap-4" onSubmit={submitProgressReport}>
              <label className="form-label">
                Accepted task
                <select
                  className="form-input"
                  onChange={(event) =>
                    setProgressReport((current) => ({
                      ...current,
                      taskId: event.target.value,
                    }))
                  }
                  required
                  value={progressReport.taskId}
                >
                  <option value="">Select task</option>
                  {tasksByStatus.accepted.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.location}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Status
                <select
                  className="form-input"
                  onChange={(event) =>
                    setProgressReport((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  value={progressReport.status}
                >
                  {progressOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Notes
                <textarea
                  className="form-input min-h-[92px] resize-y"
                  onChange={(event) =>
                    setProgressReport((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Short update for NGO/admin"
                  value={progressReport.notes}
                />
              </label>
              <button className="button-primary w-full" type="submit">
                Save progress report
              </button>
            </form>
          </section>
        </div>

        {volunteer.fieldReports?.length ? (
          <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Recent reports
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {volunteer.fieldReports.slice(0, 4).map((report) => (
                <article
                  className="rounded-md border border-primary-100 bg-slate-50 p-4"
                  key={report.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-950">
                        {report.taskLocation}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary">
                      {report.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {report.notes || 'No notes added.'}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Task board
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Track open, accepted, and completed relief tasks.
              </p>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm ring-1 ring-primary-100">
              {tasks.length} active tasks
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {columns.map((column) => (
              <section
                className="min-h-[420px] rounded-lg border border-primary-100 bg-white p-4 shadow-soft"
                key={column.key}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-950">
                    {column.title}
                  </h3>
                  <span className="grid h-8 min-w-8 place-items-center rounded-md bg-primary-50 px-2 text-sm font-bold text-primary">
                    {tasksByStatus[column.key].length}
                  </span>
                </div>

                <div className="grid gap-3">
                  {tasksByStatus[column.key].map((task) => (
                    <article
                      className="rounded-md border border-slate-200 bg-slate-50 p-4"
                      key={task.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            {task.skill}
                          </p>
                          <h4 className="mt-1 text-lg font-bold leading-6 text-slate-950">
                            {task.location}
                          </h4>
                        </div>
                        <span
                          className={[
                            'rounded-full px-2.5 py-1 text-xs font-bold ring-1',
                            urgencyStyles[task.urgency],
                          ].join(' ')}
                        >
                          {task.urgency}
                        </span>
                      </div>

                      <p className="mt-4 text-sm font-semibold leading-6 text-slate-800">
                        {task.resource}
                      </p>

                      {task.status === 'open' ? (
                        <button
                          className="button-primary mt-4 w-full"
                          disabled={!isVerified || volunteer.availability !== 'Available'}
                          onClick={() => moveTask(task.id, 'accepted')}
                          type="button"
                        >
                          Accept
                        </button>
                      ) : null}

                      {task.status === 'accepted' ? (
                        <button
                          className="button-secondary mt-4 w-full bg-white"
                          onClick={() => moveTask(task.id, 'completed')}
                          type="button"
                        >
                          Mark completed
                        </button>
                      ) : null}
                    </article>
                  ))}

                  {tasksByStatus[column.key].length === 0 ? (
                    <div className="grid min-h-32 place-items-center rounded-md border border-dashed border-primary-100 bg-primary-50 px-4 text-center text-sm font-semibold text-primary">
                      No tasks here
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export default VolunteerCoordination
