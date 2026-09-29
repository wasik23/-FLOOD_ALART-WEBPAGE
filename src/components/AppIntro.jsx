import { useEffect, useState } from 'react'

const INTRO_DURATION = 10000

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function AppIntro() {
  const [isVisible, setIsVisible] = useState(() => !prefersReducedMotion())

  useEffect(() => {
    if (!isVisible) return undefined

    const timeoutId = window.setTimeout(() => setIsVisible(false), INTRO_DURATION)
    return () => window.clearTimeout(timeoutId)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div aria-label="ReliefOps introduction" className="app-intro" role="status">
      <img
        alt=""
        className="app-intro__image"
        src="/images/flood-hero-rescue.jpg"
      />
      <div aria-hidden="true" className="app-intro__shade" />

      <div className="app-intro__frame">
        <div className="app-intro__topline">
          <span className="app-intro__mark">
            <img alt="" src="/reliefops-icon.svg" />
          </span>
          <span>Bangladesh response network</span>
          <span className="app-intro__signal"><i /> SYSTEM ONLINE</span>
        </div>

        <div className="app-intro__title-wrap">
          <p className="app-intro__eyebrow">A faster path from warning to help</p>
          <h1 className="app-intro__title">Relief<span>Ops</span></h1>
          <p className="app-intro__subtitle">Ready when communities need us.</p>
        </div>

        <div className="app-intro__bottomline">
          <div aria-hidden="true" className="app-intro__loader"><span /></div>
          <span>Connecting communities</span>
          <button className="app-intro__skip" onClick={() => setIsVisible(false)} type="button">
            Skip intro <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
      <div aria-hidden="true" className="app-intro__flash" />
    </div>
  )
}

export default AppIntro
