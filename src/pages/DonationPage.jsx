import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandHeader from '../components/BrandHeader.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import { getDonationAccounts } from '../data/reliefData.js'

function DonationPage() {
  const [accounts] = useState(getDonationAccounts)
  const groupedAccounts = useMemo(
    () =>
      accounts.reduce((groups, account) => {
        groups[account.type] = groups[account.type] || []
        groups[account.type].push(account)
        return groups
      }, {}),
    [accounts],
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <BrandHeader>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/">
          Home
        </Link>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/request-help">
          Request help
        </Link>
        <Link className="rounded-md bg-white px-3 py-2 text-sky-800" to="/register">
          Volunteer register
        </Link>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/login">
          NGO/Admin login
        </Link>
      </BrandHeader>

      <main className="page-shell">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Donate now
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950">
            Send funds directly to verified flood relief accounts.
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            Choose bKash, Nagad, or bank transfer. NGO coordinators and admins can
            update these account details from the protected records page.
          </p>
        </div>

        <div className="grid gap-6">
          {Object.entries(groupedAccounts).map(([type, items]) => (
            <section key={type}>
              <h2 className="mb-3 text-xl font-bold text-slate-950">{type}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((account) => (
                  <article
                    className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft"
                    key={account.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                          {account.label}
                        </p>
                        <h3 className="mt-2 text-2xl font-bold text-slate-950">
                          {account.accountNumber}
                        </h3>
                      </div>
                      <span className="rounded-md bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700">
                        Verified
                      </span>
                    </div>
                    <dl className="mt-5 grid gap-3 text-sm">
                      <div>
                        <dt className="font-bold text-slate-500">Account name</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {account.accountName}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-500">Branch or method</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {account.branch}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-5 rounded-md bg-primary-50 p-3 text-sm font-semibold leading-6 text-primary-900">
                      {account.instructions}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default DonationPage
