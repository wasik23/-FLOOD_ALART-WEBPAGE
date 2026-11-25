import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { requestJson } from '../services/api.js'

const channels = ['Cash', 'bKash', 'Nagad', 'Bank transfer', 'Other']
const initialForm = { amount: '', reference: '', donorName: '', isAnonymous: true, channel: 'Cash', receivedAt: '', notes: '' }
const money = new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' })

function DonationLedger() {
  const { token } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [receipts, setReceipts] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    requestJson(`/api/donations/receipts?page=${page}&limit=10`, { token, signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return
        if (!Array.isArray(payload.receipts)) throw new Error('Could not load donation receipts.')
        setReceipts(payload.receipts)
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

  const changeField = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const recordDonation = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await requestJson('/api/donations/receipts', {
        token,
        method: 'POST',
        body: JSON.stringify({
          ...form,
          receivedAt: form.receivedAt ? new Date(`${form.receivedAt}+06:00`).toISOString() : undefined,
        }),
      })
      setMessage('Donation receipt recorded. The received amount is included in the homepage total.')
      setForm(initialForm)
      setPage(1)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateReceipt = async (receiptId, changes) => {
    setBusyId(receiptId)
    setError('')
    setMessage('')
    try {
      const payload = await requestJson(`/api/donations/receipts/${receiptId}`, {
        token, method: 'PATCH', body: JSON.stringify(changes),
      })
      setReceipts((current) => current.map((receipt) => receipt.id === receiptId ? { ...receipt, ...payload.receipt } : receipt))
      setMessage(changes.isAnonymous !== undefined
        ? 'Public donation name preference saved.'
        : changes.status === 'Refunded' ? 'Refund recorded. This receipt is excluded from the homepage total.' : 'Receipt marked received and included in the homepage total.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-primary-100 bg-white shadow-soft" aria-labelledby="donation-ledger-title">
      <div className="border-b border-primary-100 p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Donation ledger</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950" id="donation-ledger-title">Track money received</h2>
        <p className="mt-2 text-sm text-slate-500">Record confirmed cash or transfer receipts in BDT. Only received donations contribute to the homepage total.</p>
      </div>
      <form className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={recordDonation}>
        <fieldset className="contents" disabled={saving || busyId !== null}>
        <label className="form-label">Amount (BDT)
          <input className="form-input" name="amount" type="number" min="0.01" max="999999999999.99" step="0.01" required value={form.amount} onChange={changeField} placeholder="0.00" />
        </label>
        <label className="form-label">Transaction or receipt reference
          <input className="form-input" name="reference" maxLength={120} required value={form.reference} onChange={changeField} placeholder="Unique transaction ID or receipt number" />
        </label>
        <label className="form-label">Payment method
          <select className="form-input" name="channel" aria-label="Payment method" value={form.channel} onChange={changeField}>
            {channels.map((channel) => <option key={channel}>{channel}</option>)}
          </select>
        </label>
        <label className="form-label">Donor name (optional)
          <input className="form-input" name="donorName" maxLength={120} value={form.donorName} onChange={changeField} />
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input className="h-4 w-4 accent-emerald-300" name="isAnonymous" type="checkbox" checked={form.isAnonymous} onChange={changeField} />
          Keep donor anonymous in the public feed
        </label>
        <label className="form-label">Received at (Bangladesh time, optional)
          <input className="form-input" name="receivedAt" type="datetime-local" value={form.receivedAt} onChange={changeField} />
        </label>
        <label className="form-label">Notes (optional)
          <input className="form-input" name="notes" maxLength={500} value={form.notes} onChange={changeField} />
        </label>
        <button className="button-primary justify-self-start disabled:opacity-50" disabled={saving || busyId !== null} type="submit">{saving ? 'Recording…' : 'Record donation'}</button>
        </fieldset>
      </form>
      {error && <p className="mx-5 mb-4 text-sm text-red-300" role="alert">{error} <button className="underline" onClick={() => { setError(''); setReloadKey((key) => key + 1) }} type="button">Reload ledger</button></p>}
      {message && <p className="mx-5 mb-4 text-sm text-emerald-300" role="status">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
            {['Reference / donor', 'Amount (BDT)', 'Method', 'Received', 'Recorded by', 'Status', 'Public name'].map((label) => <th className="px-5 py-3" key={label}>{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-primary-100">
            {!loading && receipts.map((receipt) => <tr key={receipt.id}>
              <td className="px-5 py-4"><p className="font-semibold">{receipt.reference}</p><p className="mt-1 text-slate-500">{receipt.donorName || 'Anonymous'}</p></td>
              <td className="px-5 py-4 tabular-nums">৳ {money.format(Number(receipt.amount))}</td>
              <td className="px-5 py-4">{receipt.channel}</td>
              <td className="px-5 py-4">{date.format(new Date(receipt.receivedAt))}</td>
              <td className="px-5 py-4">{receipt.recordedBy?.name || 'Operator'}</td>
              <td className="px-5 py-4"><select className="form-input py-2" aria-label={`Status for receipt ${receipt.reference}`} value={receipt.status} disabled={busyId !== null || saving} onChange={(event) => updateReceipt(receipt.id, { status: event.target.value })}>
                <option>Received</option><option>Refunded</option>
              </select></td>
              <td className="px-5 py-4"><label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-emerald-300" aria-label={`Anonymous donation ${receipt.reference}`} checked={receipt.isAnonymous ?? true} disabled={busyId !== null || saving} onChange={(event) => updateReceipt(receipt.id, { isAnonymous: event.target.checked })} />
                Anonymous
              </label></td>
            </tr>)}
            {(loading || receipts.length === 0) && <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={7}>{loading ? 'Loading donation receipts…' : error ? 'Donation receipts could not be loaded.' : 'No donations recorded yet.'}</td></tr>}
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

export default DonationLedger
