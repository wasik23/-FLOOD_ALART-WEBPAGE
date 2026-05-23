import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROLE_HOME_PATHS, ROLE_OPTIONS } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import useSocket from '../hooks/useSocket.js'

const initialAlerts = [
  {
    id: 'alert-seed-sylhet',
    district: 'Sylhet',
    message: 'Standing water reported near Kanaighat relief route.',
    severity: 'High',
    timestamp: new Date().toISOString(),
    title: 'Field alert',
  },
  {
    id: 'alert-seed-gaibandha',
    district: 'Gaibandha',
    message: 'Dry food stock is below 30% at Fulchhari shelter.',
    severity: 'Medium',
    timestamp: new Date().toISOString(),
    title: 'Supply watch',
  },
]

const initialTasks = [
  {
    id: 'task-water-sylhet',
    district: 'Sylhet',
    status: 'Open',
    title: 'Deliver water purification tablets',
    volunteerName: null,
  },
  {
    id: 'task-medical-jamalpur',
    district: 'Jamalpur',
    status: 'Open',
    title: 'Support mobile medical desk',
    volunteerName: null,
  },
  {
    id: 'task-food-gaibandha',
    district: 'Gaibandha',
    status: 'Open',
    title: 'Pack dry food kits',
    volunteerName: null,
  },
]

const severityStyles = {
  Critical: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800',
}

function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [alerts, setAlerts] = useState(initialAlerts)
  const [tasks, setTasks] = useState(initialTasks)
  const roleLabel = t(`roles.${user.role}`)

  const socketHandlers = useMemo(
    () => ({
      new_alert: (alert) => {
        setAlerts((current) => [
          {
            id: alert.id || `alert-${Date.now()}`,
            district: alert.district || 'Bangladesh',
            message: alert.message || 'New field alert received.',
            severity: alert.severity || 'Medium',
            timestamp: alert.timestamp || new Date().toISOString(),
            title: alert.title || 'Relief alert',
          },
          ...current,
        ].slice(0, 6))
      },
      volunteer_accepted_task: (taskUpdate) => {
        setTasks((current) => {
          const taskId = taskUpdate.taskId || taskUpdate.id
          const nextTask = {
            id: taskId || `task-${Date.now()}`,
            district: taskUpdate.district || 'Unassigned',
            status: taskUpdate.status || 'Accepted',
            title: taskUpdate.taskTitle || taskUpdate.title || 'Relief task',
            volunteerName: taskUpdate.volunteerName || 'Volunteer',
          }
          const taskExists = current.some((task) => task.id === nextTask.id)

          if (!taskExists) {
            return [nextTask, ...current].slice(0, 6)
          }

          return current.map((task) =>
            task.id === nextTask.id ? { ...task, ...nextTask } : task,
          )
        })
      },
    }),
    [],
  )
  const { isConnected } = useSocket(socketHandlers)

  return (
    <section className="page-shell">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('dashboard.eyebrow')}
          </p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">
            {t('dashboard.workspace', { role: roleLabel })}
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            {t('dashboard.realtimeSignedIn', { name: user.name })}
          </p>
        </div>
        <span
          className={[
            'self-start rounded-md px-3 py-2 text-sm font-semibold md:self-auto',
            isConnected
              ? 'bg-green-100 text-green-800'
              : 'bg-slate-200 text-slate-700',
          ].join(' ')}
        >
          {isConnected
            ? t('dashboard.socketConnected')
            : t('dashboard.socketOffline')}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ROLE_OPTIONS.map((role) => {
          const isCurrentRole = role.value === user.role

          return (
            <article
              className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft"
              key={role.value}
            >
              <div className="flex flex-col justify-between gap-5 sm:flex-row">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    {t(`roles.${role.value}`)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(`dashboard.descriptions.${role.value}`)}
                  </p>
                </div>
                {isCurrentRole ? (
                  <Link
                    className="button-primary self-start"
                    to={ROLE_HOME_PATHS[role.value]}
                  >
                    {t('dashboard.open')}
                  </Link>
                ) : (
                  <span className="self-start rounded-md bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700">
                    {t('dashboard.protected')}
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                {t('dashboard.alertFeed')}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                {t('dashboard.liveReports')}
              </h2>
            </div>
            <span className="rounded-md bg-primary-50 px-3 py-1 text-xs font-bold text-primary-800">
              {t('dashboard.alertCount', { count: alerts.length })}
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {alerts.map((alert) => (
              <article
                className="rounded-md border border-primary-100 bg-slate-50 p-4"
                key={alert.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{alert.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {alert.district}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-md px-2.5 py-1 text-xs font-bold',
                      severityStyles[alert.severity] || severityStyles.Medium,
                    ].join(' ')}
                  >
                    {t(`risk.${alert.severity}`)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {alert.message}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('dashboard.taskBoard')}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            {t('dashboard.volunteerAssignments')}
          </h2>

          <div className="mt-5 grid gap-3">
            {tasks.map((task) => (
              <article
                className="rounded-md border border-primary-100 bg-slate-50 p-4"
                key={task.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{task.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {task.district}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-md px-2.5 py-1 text-xs font-bold',
                      task.status === 'Accepted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800',
                    ].join(' ')}
                  >
                    {t(`dashboard.taskStatus.${task.status}`)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {task.volunteerName
                    ? t('dashboard.acceptedBy', { name: task.volunteerName })
                    : t('dashboard.waitingVolunteer')}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export default Dashboard
