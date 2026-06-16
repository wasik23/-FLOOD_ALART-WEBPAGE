import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

function BrandHeader({ children }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0b1111]/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          aria-label="ReliefOps home"
          className="group flex items-center gap-3"
          to="/"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-300/10 bg-emerald-300/10 p-2 transition group-hover:border-emerald-300/30">
            <img alt="" className="h-full w-full" src="/reliefops-icon.svg" />
          </span>
          <span className="text-base font-extrabold text-white">
            ReliefOps
          </span>
        </Link>

        {children ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-300">
            {children}
          </div>
        ) : null}
      </div>
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
