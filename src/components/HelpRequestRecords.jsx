import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { requestJson } from '../services/api.js'

const statuses = ['Pending', 'Assigned', 'Completed', 'Cancelled']

function HelpRequestRecords() {
  const { token } = useAuth()
  const [requests, setRequests] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    requestJson(`/api/help-requests?page=${page}&limit=25`, { token, signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return
        if (!Array.isArray(payload.requests)) throw new Error('Could not load help requests.')
        setRequests(payload.requests)
        setPages(Math.max(1, payload.pages))
        setError('')
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err.message)
        setLoading(false)
      })
    return () => controller.abort()
  }, [page, reloadKey, token])

  const edit = (id, field, value) => {
    setRequests((current) => current.map((request) => request.id === id ? { ...request, [field]: value } : request))
    setMessage('')
  }

  const save = async (request) => {
    setBusyId(request.id)
    setError('')
    setMessage('')
    try {
      const payload = await requestJson(`/api/help-requests/${request.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ status: request.status, familiesHelped: Number(request.familiesHelped) }),
      })
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, ...payload.request } : item))
      setMessage('Request saved to the database. Families recorded on completed requests are included in the homepage total.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-primary-100 bg-white shadow-soft" aria-labelledby="help-request-records-title">
      <div className="border-b border-primary-100 p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Public help requests</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950" id="help-request-records-title">Track families supported</h2>
        <p className="mt-2 text-sm text-slate-500">Enter the actual number of families helped, mark the request completed, then save. Pending, assigned and cancelled requests are excluded from the homepage total.</p>
      </div>
      {error && <p className="m-5 text-sm text-red-300" role="alert">{error} <button className="underline" onClick={() => { setError(''); setReloadKey((key) => key + 1) }} type="button">Reload requests</button></p>}
      {message && <p className="m-5 text-sm text-emerald-300" role="status">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
            {['Requester', 'Location', 'Need / people', 'Families helped', 'Status', 'Notes', 'Action'].map((label) => <th className="px-5 py-3" key={label}>{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-primary-100">
            {!loading && requests.map((request) => <tr key={request.id}>
              <td className="px-5 py-4"><p className="font-bold">{request.name}</p><p className="mt-1 text-slate-500">{request.phone}</p></td>
              <td className="px-5 py-4"><p>{request.upazila}, {request.district}</p><p className="mt-1 max-w-[240px] text-slate-500">{request.address}</p></td>
              <td className="px-5 py-4">{request.needType}<p className="mt-1 text-slate-500">{request.peopleCount} people</p></td>
              <td className="px-5 py-4"><input className="form-input w-28 py-2" type="number" min={0} max={10000} step={1} aria-label={`Families helped for ${request.name}`} value={request.familiesHelped ?? 0} disabled={busyId === request.id} onChange={(event) => edit(request.id, 'familiesHelped', event.target.value)} /></td>
              <td className="px-5 py-4"><select className="form-input py-2" aria-label={`Status for ${request.name}`} value={request.status} disabled={busyId === request.id} onChange={(event) => edit(request.id, 'status', event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td>
              <td className="px-5 py-4"><p className="max-w-[240px] text-slate-500">{request.notes || 'No notes'}</p></td>
              <td className="px-5 py-4"><button className="button-primary disabled:opacity-50" disabled={busyId !== null} onClick={() => save(request)} type="button">{busyId === request.id ? 'Saving…' : 'Save request'}</button></td>
            </tr>)}
            {(loading || requests.length === 0) && <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={7}>{loading ? 'Loading help requests…' : error ? 'Help requests could not be loaded.' : 'No help requests yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-primary-100 p-5 text-sm">
        <button className="button-secondary disabled:opacity-50" disabled={loading || busyId !== null || page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="button-secondary disabled:opacity-50" disabled={loading || busyId !== null || page >= pages} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
      </div>
    </section>
  )
}

export default HelpRequestRecords
