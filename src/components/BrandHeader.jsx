import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

function BrandHeader({ children }) {
  const { i18n } = useTranslation()
  const isBangla = i18n.language === 'bn-BD'

  return (
    <header className="border-b border-sky-950/20 bg-slate-950 text-white">
      <div className="bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.28),transparent_30%),linear-gradient(135deg,#082f49_0%,#0f766e_52%,#0f172a_100%)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-5 text-center sm:px-6 md:flex-row md:justify-between md:text-left lg:px-8">
          <Link
            aria-label="ReliefOps home"
            className="group flex items-center gap-4"
            to="/"
          >
            <span className="grid h-20 w-20 place-items-center rounded-2xl border border-white/25 bg-white/95 p-2 shadow-xl shadow-sky-950/30 transition group-hover:scale-[1.03]">
              <img
                alt=""
                className="h-full w-full"
                src="/reliefops-icon.svg"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-3xl font-black leading-none tracking-normal text-white sm:text-4xl">
                ReliefOps
              </span>
              <span className="mt-2 block text-sm font-semibold uppercase tracking-wide text-sky-100 sm:text-base">
                {isBangla
                  ? 'বন্যা সতর্কতা ও ত্রাণ সহায়তা প্ল্যাটফর্ম'
                  : 'Flood Early Warning and Relief Support Platform'}
              </span>
            </span>
          </Link>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
              <p className="text-lg font-black text-white">24/7</p>
              <p className="text-xs font-semibold text-sky-100">
                {isBangla ? 'সতর্কতা' : 'Alerts'}
              </p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
              <p className="text-lg font-black text-white">64</p>
              <p className="text-xs font-semibold text-sky-100">
                {isBangla ? 'জেলা' : 'Districts'}
              </p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
              <p className="text-lg font-black text-white">SOS</p>
              <p className="text-xs font-semibold text-sky-100">
                {isBangla ? 'সহায়তা' : 'Relief'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {children ? (
        <div className="border-t border-white/10 bg-sky-900 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-3 text-sm font-semibold sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      ) : null}
    </header>
  )
}

BrandHeader.propTypes = {
  children: PropTypes.node,
}

BrandHeader.defaultProps = {
  children: null,
}

export default BrandHeader
