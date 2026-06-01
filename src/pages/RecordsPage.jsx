import { useState } from 'react'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import {
  getDonationAccounts,
  getHelpRequests,
  getVolunteerProfiles,
  saveDonationAccounts,
  saveHelpRequests,
  saveVolunteerProfiles,
} from '../data/reliefData.js'

const ADMIN_USER_OPS_KEY = 'admin_user_ops'
const requestStatuses = ['Pending', 'Assigned', 'Completed']
const donationFields = [
  ['label', 'Provider'],
  ['accountName', 'Account name'],
  ['accountNumber', 'Account number'],
  ['branch', 'Branch or method'],
  ['instructions', 'Instructions'],
]
const volunteerStatusStyles = {
  Active: 'bg-green-100 text-green-800',
  Banned: 'bg-red-100 text-red-800',
}

function readJson(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function RecordsPage() {
  const { user } = useAuth()
  const [volunteers, setVolunteers] = useState(getVolunteerProfiles)
  const [accounts, setAccounts] = useState(getDonationAccounts)
  const [helpRequests, setHelpRequests] = useState(getHelpRequests)
  const [volunteerOperations, setVolunteerOperations] = useState(() =>
    readJson(ADMIN_USER_OPS_KEY, {}),
  )
  const [savedMessage, setSavedMessage] = useState('')
  const [savedDonationAccount, setSavedDonationAccount] = useState('')
  const canManageVolunteers = user.role === ROLES.NGO

  const updateVolunteer = (userId, field, value) => {
    setVolunteers((current) =>
      current.map((volunteer) =>
        volunteer.userId === userId ? { ...volunteer, [field]: value } : volunteer,
      ),
    )
  }

  const updateVolunteerOperation = (userId, updates) => {
    setVolunteerOperations((current) => ({
      ...current,
      [userId]: {
        status: 'Active',
        verified: false,
        ...current[userId],
        ...updates,
      },
    }))
    setSavedMessage('Volunteer approval update ready. Save changes to keep it.')
  }

  const updateAccount = (id, field, value) => {
    setSavedDonationAccount('')
    setAccounts((current) =>
      current.map((account) =>
        account.id === id ? { ...account, [field]: value } : account,
      ),
    )
  }

  const updateHelpRequest = (id, status) => {
    setHelpRequests((current) =>
      current.map((request) =>
        request.id === id
          ? { ...request, status, updatedAt: new Date().toISOString() }
          : request,
      ),
    )
  }

  const saveRecords = () => {
    saveVolunteerProfiles(volunteers)
    saveDonationAccounts(accounts)
    saveHelpRequests(helpRequests)
    writeJson(ADMIN_USER_OPS_KEY, volunteerOperations)
    setSavedMessage('Records saved for NGO/admin review.')
  }

  const saveDonationAccount = (accountId) => {
    saveDonationAccounts(accounts)
    const account = accounts.find((item) => item.id === accountId)
    setSavedDonationAccount(accountId)
    setSavedMessage(`${account?.label || 'Donation account'} changes saved.`)
  }

  return (
    <section className="page-shell">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            NGO and admin records
          </p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">
            Volunteer data and donation account editor
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            Review volunteer registration details and keep public donation
            instructions accurate.
          </p>
        </div>
        <button className="button-primary self-start md:self-auto" onClick={saveRecords} type="button">
          Save changes
        </button>
      </div>

      {savedMessage ? (
        <p className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          {savedMessage}
        </p>
      ) : null}

      {canManageVolunteers ? (
      <section className="rounded-lg border border-primary-100 bg-white shadow-soft">
        <div className="border-b border-primary-100 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            NGO volunteer approval
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Field volunteer profiles
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            NGO coordinators approve volunteers and manage field availability.
            Site owner/admin approves NGO accounts separately.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Photo</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Guardian phone</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Verification</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Availability</th>
                <th className="px-5 py-3">Reports</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {volunteers.map((volunteer) => {
                const operation = volunteerOperations[volunteer.userId] || {}
                const isVerified = operation.verified ?? false
                const status = operation.status || 'Active'

                return (
                  <tr key={volunteer.userId}>
                    <td className="px-5 py-4">
                      {volunteer.imageData ? (
                        <img
                          alt={volunteer.name}
                          className="h-14 w-14 rounded-md object-cover"
                          src={volunteer.imageData}
                        />
                      ) : (
                        <span className="grid h-14 w-14 place-items-center rounded-md bg-primary-50 text-xs font-bold text-primary">
                          No image
                        </span>
                      )}
                    </td>
                    {['name', 'phone', 'address', 'guardianPhone', 'location'].map((field) => (
                      <td className="px-5 py-4" key={field}>
                        <input
                          className="form-input py-2"
                          onChange={(event) =>
                            updateVolunteer(volunteer.userId, field, event.target.value)
                          }
                          value={volunteer[field] || ''}
                        />
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <span
                        className={[
                          'rounded-md px-2.5 py-1 text-xs font-bold',
                          isVerified
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800',
                        ].join(' ')}
                      >
                        {isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          'rounded-md px-2.5 py-1 text-xs font-bold',
                          volunteerStatusStyles[status],
                        ].join(' ')}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        className="form-input py-2"
                        onChange={(event) =>
                          updateVolunteer(
                            volunteer.userId,
                            'availability',
                            event.target.value,
                          )
                        }
                        value={volunteer.availability || 'Available'}
                      >
                        {['Available', 'Busy', 'Offline'].map((availability) => (
                          <option key={availability} value={availability}>
                            {availability}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <div className="grid max-w-[260px] gap-2">
                        {(volunteer.fieldReports || []).slice(0, 2).map((report) => (
                          <div
                            className="rounded-md bg-slate-50 p-2 text-xs text-slate-600"
                            key={report.id}
                          >
                            <p className="font-bold text-slate-900">
                              {report.status} | {report.taskLocation}
                            </p>
                            <p className="mt-1">{report.notes || 'No notes'}</p>
                          </div>
                        ))}
                        {(volunteer.fieldReports || []).length === 0 ? (
                          <span className="text-slate-500">No reports</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="button-secondary px-3 py-2"
                          disabled={isVerified}
                          onClick={() =>
                            updateVolunteerOperation(volunteer.userId, {
                              verified: true,
                            })
                          }
                          type="button"
                        >
                          Verify
                        </button>
                        <button
                          className="button-secondary px-3 py-2"
                          onClick={() =>
                            updateVolunteerOperation(volunteer.userId, {
                              status: status === 'Banned' ? 'Active' : 'Banned',
                            })
                          }
                          type="button"
                        >
                          {status === 'Banned' ? 'Restore' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {volunteers.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center font-semibold text-slate-500" colSpan="11">
                    No volunteer profiles yet. New volunteer registrations will appear here.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      <section className="mt-8 rounded-lg border border-primary-100 bg-white shadow-soft">
        <div className="border-b border-primary-100 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Public help requests
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            No-login requests from affected people
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Requester</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Need</th>
                <th className="px-5 py-3">People</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {helpRequests.map((request) => (
                <tr key={request.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">{request.name}</p>
                    <p className="mt-1 text-slate-500">{request.phone}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      {request.upazila}, {request.district}
                    </p>
                    <p className="mt-1 max-w-[240px] text-slate-500">
                      {request.address}
                    </p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {request.needType}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {request.peopleCount}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      className="form-input py-2"
                      onChange={(event) =>
                        updateHelpRequest(request.id, event.target.value)
                      }
                      value={request.status}
                    >
                      {requestStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <p className="max-w-[260px] text-slate-600">
                      {request.notes || 'No extra notes'}
                    </p>
                  </td>
                </tr>
              ))}
              {helpRequests.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center font-semibold text-slate-500" colSpan="6">
                    No public help requests yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border border-primary-100 bg-white shadow-soft">
        <div className="bg-slate-950 p-5 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-200">
            Donation settings
          </p>
          <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-bold">
                Public donation account control
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Update bKash, Nagad, and bank transfer details shown on the
                public donation page. Save each account after editing.
              </p>
            </div>
            <span className="self-start rounded-md bg-white/10 px-3 py-2 text-sm font-bold text-white md:self-auto">
              {accounts.length} active channels
            </span>
          </div>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-2">
          {accounts.map((account) => (
            <article
              className="overflow-hidden rounded-lg border border-primary-100 bg-slate-50"
              key={account.id}
            >
              <div className="border-b border-primary-100 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                      {account.type}
                    </p>
                    <h3 className="mt-1 text-2xl font-black text-slate-950">
                      {account.label}
                    </h3>
                  </div>
                  <span className="rounded-md bg-green-100 px-3 py-2 text-xs font-bold text-green-800">
                    Public
                  </span>
                </div>
                <div className="mt-4 rounded-lg bg-primary-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    Live preview
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-950">
                    {account.accountNumber || 'No number set'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {account.accountName || 'No account name'} |{' '}
                    {account.branch || 'No branch/method'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-5">
                {donationFields.map(([field, label]) => {
                  const isLongField = field === 'instructions'

                  return (
                    <div className="grid gap-2" key={field}>
                      <label className="text-sm font-semibold text-slate-800">
                        {label}
                      </label>
                      {isLongField ? (
                        <textarea
                          className="form-input min-h-[92px] resize-y bg-white"
                          onChange={(event) =>
                            updateAccount(account.id, field, event.target.value)
                          }
                          value={account[field]}
                        />
                      ) : (
                        <input
                          className="form-input bg-white"
                          onChange={(event) =>
                            updateAccount(account.id, field, event.target.value)
                          }
                          value={account[field]}
                        />
                      )}
                    </div>
                  )
                })}
                <button
                  className={[
                    'mt-2 rounded-md px-4 py-3 text-sm font-bold transition',
                    savedDonationAccount === account.id
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-950 text-white hover:bg-primary',
                  ].join(' ')}
                  onClick={() => saveDonationAccount(account.id)}
                  type="button"
                >
                  {savedDonationAccount === account.id ? 'Saved' : 'Save changes'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

export default RecordsPage
