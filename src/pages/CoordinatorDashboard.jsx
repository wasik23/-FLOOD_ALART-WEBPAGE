import { useMemo, useState } from 'react'
import {
  getHelpRequests,
  getVolunteerProfiles,
  updateHelpRequest,
} from '../data/reliefData.js'

const requestStatuses = [
  'Pending',
  'Verified',
  'Assigned',
  'In progress',
  'Need backup',
  'Completed',
]

const needWeights = {
  Rescue: 40,
  Medicine: 30,
  Shelter: 24,
  'Clean water': 20,
  Food: 18,
  Other: 10,
}

const statusStyles = {
  Pending: 'bg-amber-100 text-amber-800',
  Verified: 'bg-sky-100 text-sky-800',
  Assigned: 'bg-blue-100 text-blue-800',
  'In progress': 'bg-purple-100 text-purple-800',
  'Need backup': 'bg-red-100 text-red-800',
  Completed: 'bg-green-100 text-green-800',
}

const availabilityStyles = {
  Available: 'bg-green-100 text-green-800',
  Busy: 'bg-amber-100 text-amber-800',
  Offline: 'bg-slate-200 text-slate-700',
}

function getPriorityScore(request) {
  const peopleScore = Math.min(Number(request.peopleCount) || 1, 50)
  const needScore = needWeights[request.needType] || needWeights.Other
  const waitingScore = request.status === 'Pending' ? 15 : 0
  return peopleScore + needScore + waitingScore
}

function getPriorityLabel(score) {
  if (score >= 75) return 'Critical'
  if (score >= 55) return 'High'
  if (score >= 35) return 'Medium'
  return 'Low'
}

function CoordinatorDashboard() {
  const [requests, setRequests] = useState(getHelpRequests)
  const [volunteers] = useState(getVolunteerProfiles)
  const [filters, setFilters] = useState({
    district: 'All',
    status: 'All',
  })
  const [savedMessage, setSavedMessage] = useState('')

  const districts = useMemo(
    () =>
      Array.from(new Set(requests.map((request) => request.district).filter(Boolean))).sort(),
    [requests],
  )

  const availableVolunteers = useMemo(
    () =>
      volunteers.filter(
        (volunteer) => (volunteer.availability || 'Available') === 'Available',
      ),
    [volunteers],
  )

  const enrichedRequests = useMemo(
    () =>
      requests
        .map((request) => {
          const score = getPriorityScore(request)
          return {
            ...request,
            priorityScore: score,
            priority: getPriorityLabel(score),
          }
        })
        .filter((request) => {
          const districtMatch =
            filters.district === 'All' || request.district === filters.district
          const statusMatch =
            filters.status === 'All' || request.status === filters.status
          return districtMatch && statusMatch
        })
        .sort((first, second) => second.priorityScore - first.priorityScore),
    [filters, requests],
  )

  const stats = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === 'Pending').length,
      assigned: requests.filter((request) => request.assignedVolunteerId).length,
      completed: requests.filter((request) => request.status === 'Completed').length,
      availableVolunteers: availableVolunteers.length,
    }),
    [availableVolunteers.length, requests],
  )

  const fieldReports = useMemo(
    () =>
      volunteers
        .flatMap((volunteer) =>
          (volunteer.fieldReports || []).map((report) => ({
            ...report,
            volunteerName: volunteer.name,
            volunteerPhone: volunteer.phone,
          })),
        )
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)),
    [volunteers],
  )

  const updateRequest = (requestId, updates) => {
    const updatedRequest = updateHelpRequest(requestId, updates)

    if (!updatedRequest) return

    setRequests((current) =>
      current.map((request) =>
        request.id === requestId ? updatedRequest : request,
      ),
    )
    setSavedMessage('Coordinator update saved.')
  }

  const assignVolunteer = (requestId, volunteerId) => {
    const volunteer = volunteers.find((item) => item.userId === volunteerId)

    updateRequest(requestId, {
      assignedVolunteerId: volunteer?.userId || '',
      assignedVolunteerName: volunteer?.name || '',
      assignedVolunteerPhone: volunteer?.phone || '',
      status: volunteer ? 'Assigned' : 'Pending',
    })
  }

  return (
    <section className="page-shell">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            NGO coordination
          </p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">
            Request triage and volunteer assignment
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            Review no-login public help requests, prioritize urgent cases,
            assign available volunteers, and follow field reports.
          </p>
        </div>
        {savedMessage ? (
          <span className="self-start rounded-md bg-green-100 px-3 py-2 text-sm font-bold text-green-800 md:self-auto">
            {savedMessage}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Pending', stats.pending],
          ['Assigned', stats.assigned],
          ['Completed', stats.completed],
          ['Available volunteers', stats.availableVolunteers],
        ].map(([label, value]) => (
          <article
            className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft"
            key={label}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-primary-100 bg-white shadow-soft">
          <div className="border-b border-primary-100 p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Triage queue
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Prioritized help requests
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  className="form-input min-w-[160px] py-2"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      district: event.target.value,
                    }))
                  }
                  value={filters.district}
                >
                  <option value="All">All districts</option>
                  {districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
                <select
                  className="form-input min-w-[150px] py-2"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  value={filters.status}
                >
                  <option value="All">All status</option>
                  {requestStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5">
            {enrichedRequests.map((request) => (
              <article
                className="rounded-lg border border-primary-100 bg-slate-50 p-5"
                key={request.id}
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-700">
                        {request.priority} priority
                      </span>
                      <span
                        className={[
                          'rounded-md px-2.5 py-1 text-xs font-bold',
                          statusStyles[request.status] || statusStyles.Pending,
                        ].join(' ')}
                      >
                        {request.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-slate-950">
                      {request.needType} needed in {request.upazila}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      {request.name} | {request.phone} | {request.peopleCount} people
                    </p>
                    <p className="mt-3 leading-6 text-slate-600">
                      {request.address}
                    </p>
                    {request.notes ? (
                      <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-slate-600">
                        {request.notes}
                      </p>
                    ) : null}
                    {request.assignedVolunteerName ? (
                      <p className="mt-3 text-sm font-bold text-primary">
                        Assigned: {request.assignedVolunteerName}
                        {request.assignedVolunteerPhone
                          ? ` (${request.assignedVolunteerPhone})`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid min-w-[260px] gap-3 self-start">
                    <label className="form-label">
                      Status
                      <select
                        className="form-input py-2"
                        onChange={(event) =>
                          updateRequest(request.id, { status: event.target.value })
                        }
                        value={request.status}
                      >
                        {requestStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-label">
                      Assign volunteer
                      <select
                        className="form-input py-2"
                        onChange={(event) =>
                          assignVolunteer(request.id, event.target.value)
                        }
                        value={request.assignedVolunteerId || ''}
                      >
                        <option value="">Unassigned</option>
                        {availableVolunteers.map((volunteer) => (
                          <option key={volunteer.userId} value={volunteer.userId}>
                            {volunteer.name} | {volunteer.location || 'No area'}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </article>
            ))}
            {enrichedRequests.length === 0 ? (
              <div className="rounded-md border border-dashed border-primary-100 bg-primary-50 p-8 text-center text-sm font-semibold text-primary">
                No help requests match the current filters.
              </div>
            ) : null}
          </div>
        </section>

        <aside className="grid gap-6 self-start">
          <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Volunteer board
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Available teams
            </h2>
            <div className="mt-4 grid gap-3">
              {volunteers.map((volunteer) => (
                <article
                  className="rounded-md border border-primary-100 bg-slate-50 p-4"
                  key={volunteer.userId}
                >
                  <div className="flex items-start gap-3">
                    {volunteer.imageData ? (
                      <img
                        alt={volunteer.name}
                        className="h-12 w-12 rounded-md object-cover"
                        src={volunteer.imageData}
                      />
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-md bg-primary-50 text-xs font-bold text-primary">
                        V
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-950">
                        {volunteer.name}
                      </p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {volunteer.location || 'No work area set'}
                      </p>
                    </div>
                    <span
                      className={[
                        'rounded-md px-2 py-1 text-xs font-bold',
                        availabilityStyles[volunteer.availability || 'Available'],
                      ].join(' ')}
                    >
                      {volunteer.availability || 'Available'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-600">
                    {(volunteer.skills || []).length
                      ? volunteer.skills.join(', ')
                      : 'No skills added'}
                  </p>
                </article>
              ))}
              {volunteers.length === 0 ? (
                <p className="rounded-md bg-primary-50 p-4 text-sm font-semibold text-primary">
                  No volunteer profiles yet.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Field reports
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Latest volunteer updates
            </h2>
            <div className="mt-4 grid gap-3">
              {fieldReports.slice(0, 5).map((report) => (
                <article
                  className="rounded-md border border-primary-100 bg-slate-50 p-4"
                  key={report.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">
                        {report.taskLocation}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {report.volunteerName}
                      </p>
                    </div>
                    <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-bold text-primary">
                      {report.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {report.notes || 'No notes added.'}
                  </p>
                </article>
              ))}
              {fieldReports.length === 0 ? (
                <p className="rounded-md bg-primary-50 p-4 text-sm font-semibold text-primary">
                  No field reports yet.
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

export default CoordinatorDashboard
