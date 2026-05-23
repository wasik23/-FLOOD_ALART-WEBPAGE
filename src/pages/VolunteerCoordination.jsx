import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const skills = [
  { value: 'boat', label: 'Boat' },
  { value: 'medical', label: 'Medical' },
  { value: 'food', label: 'Food' },
  { value: 'rescue', label: 'Rescue' },
]

const initialTasks = [
  {
    id: 1,
    location: 'Sylhet Sadar',
    resource: 'Rescue boat and flotation vests',
    urgency: 'High',
    status: 'open',
  },
  {
    id: 2,
    location: 'Sunamganj',
    resource: 'Medical triage team',
    urgency: 'Critical',
    status: 'open',
  },
  {
    id: 3,
    location: 'Kurigram',
    resource: 'Dry food packets',
    urgency: 'Medium',
    status: 'accepted',
  },
  {
    id: 4,
    location: 'Netrokona',
    resource: 'Evacuation support',
    urgency: 'High',
    status: 'completed',
  },
  {
    id: 5,
    location: 'Feni',
    resource: 'Clean water distribution',
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

function VolunteerCoordination() {
  const { t } = useTranslation()
  const [volunteer, setVolunteer] = useState({
    name: '',
    location: '',
    skills: [],
  })
  const [registeredVolunteer, setRegisteredVolunteer] = useState(null)
  const [tasks, setTasks] = useState(initialTasks)

  const tasksByStatus = useMemo(
    () =>
      columns.reduce((groupedTasks, column) => {
        groupedTasks[column.key] = tasks.filter((task) => task.status === column.key)
        return groupedTasks
      }, {}),
    [tasks],
  )

  const updateField = (event) => {
    const { name, value } = event.target
    setVolunteer((current) => ({ ...current, [name]: value }))
  }

  const toggleSkill = (event) => {
    const { checked, value } = event.target
    setVolunteer((current) => ({
      ...current,
      skills: checked
        ? [...current.skills, value]
        : current.skills.filter((skill) => skill !== value),
    }))
  }

  const registerVolunteer = (event) => {
    event.preventDefault()
    setRegisteredVolunteer(volunteer)
  }

  const moveTask = (taskId, status) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, status } : task,
      ),
    )
  }

  return (
    <section className="page-shell">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          {t('volunteer.eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950">
          {t('volunteer.title')}
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          {t('volunteer.intro')}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="self-start rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold text-slate-950">
            {t('volunteer.registerTitle')}
          </h2>
          <form className="mt-6 grid gap-5" onSubmit={registerVolunteer}>
            <label className="form-label">
              {t('volunteer.name')}
              <input
                className="form-input"
                name="name"
                onChange={updateField}
                placeholder="Your full name"
                required
                type="text"
                value={volunteer.name}
              />
            </label>

            <label className="form-label">
              {t('volunteer.location')}
              <input
                className="form-input"
                name="location"
                onChange={updateField}
                placeholder={t('volunteer.locationPlaceholder')}
                required
                type="text"
                value={volunteer.location}
              />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-800">
                {t('volunteer.skills')}
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {skills.map((skill) => (
                  <label className="role-option" key={skill.value}>
                    <input
                      checked={volunteer.skills.includes(skill.value)}
                      onChange={toggleSkill}
                      type="checkbox"
                      value={skill.value}
                    />
                    {t(`volunteer.skillLabels.${skill.value}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="button-primary w-full" type="submit">
              {t('volunteer.register')}
            </button>
          </form>

          {registeredVolunteer ? (
            <div className="mt-6 rounded-md border border-primary-100 bg-primary-50 p-4">
              <p className="text-sm font-bold text-primary-900">
                {t('volunteer.ready', {
                  name: registeredVolunteer.name,
                  location: registeredVolunteer.location,
                })}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {t('volunteer.skillsLine', {
                  skills: registeredVolunteer.skills.length
                    ? registeredVolunteer.skills
                        .map((skill) => t(`volunteer.skillLabels.${skill}`))
                        .join(', ')
                    : t('volunteer.generalSupport'),
                })}
              </p>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                {t('volunteer.board')}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t('volunteer.boardHint')}
              </p>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm ring-1 ring-primary-100">
              {t('volunteer.activeTasks', { count: tasks.length })}
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
                    {t(`volunteer.columns.${column.key}`)}
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
                            {t('volunteer.locationLabel')}
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
                          {t(`volunteer.urgency.${task.urgency}`)}
                        </span>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {t('volunteer.resourceNeeded')}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
                          {task.resource}
                        </p>
                      </div>

                      {task.status === 'open' ? (
                        <button
                          className="button-primary mt-4 w-full"
                          onClick={() => moveTask(task.id, 'accepted')}
                          type="button"
                        >
                          {t('volunteer.accept')}
                        </button>
                      ) : null}

                      {task.status === 'accepted' ? (
                        <button
                          className="button-secondary mt-4 w-full bg-white"
                          onClick={() => moveTask(task.id, 'completed')}
                          type="button"
                        >
                          {t('volunteer.complete')}
                        </button>
                      ) : null}
                    </article>
                  ))}

                  {tasksByStatus[column.key].length === 0 ? (
                    <div className="grid min-h-32 place-items-center rounded-md border border-dashed border-primary-100 bg-primary-50 px-4 text-center text-sm font-semibold text-primary">
                      {t('volunteer.empty')}
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default VolunteerCoordination
