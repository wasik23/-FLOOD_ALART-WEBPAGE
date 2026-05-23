import { Link } from 'react-router-dom'
import useSocket from '../hooks/useSocket.js'
import useTheme from '../hooks/useTheme.js'

function Home() {
  const { colors } = useTheme()
  const { isConnected } = useSocket()

  return (
    <section className="page-shell">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            React + Vite starter
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
            Bangladesh-themed realtime mapping foundation.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Built with Tailwind CSS, React Router, Leaflet.js, and Socket.io-client,
            with a clean folder structure ready for features.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/map" className="button-primary">
              Open map
            </Link>
            <a href="https://socket.io/" className="button-secondary">
              Socket docs
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
          <div className="aspect-[3/2] rounded-md bg-primary p-8">
            <div className="grid h-full place-items-center rounded-md border border-white/20">
              <div className="h-28 w-28 rounded-full bg-accent shadow-lg shadow-black/20" />
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Primary
              </dt>
              <dd className="mt-1 font-mono text-sm text-slate-900">
                {colors.primary}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Accent
              </dt>
              <dd className="mt-1 font-mono text-sm text-slate-900">
                {colors.accent}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Socket
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {isConnected ? 'Connected' : 'Idle'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}

export default Home
