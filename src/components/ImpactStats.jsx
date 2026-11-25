import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getImpactStats } from '../services/impactStats.js'
import { getMockImpactStats } from '../data/mockReliefImpact.js'

const countDuration = 1800
const copy = {
  en: {
    title: 'Relief impact at a glance',
    demo: 'Mock data · waiting for backend',
    updated: 'Updated',
    retry: 'Try again',
    stats: [
      { id: 'donationsTaka', label: 'Taka donated' },
      { id: 'familiesHelped', label: 'Families helped' },
      { id: 'activeVolunteers', label: 'Active volunteers' },
      { id: 'reliefCampsOpen', label: 'Relief camps open' },
    ],
  },
  'bn-BD': {
    title: 'এক নজরে ত্রাণ কার্যক্রম',
    demo: 'নমুনা তথ্য · ব্যাকএন্ডের সংযোগের অপেক্ষায়',
    updated: 'হালনাগাদ',
    retry: 'আবার চেষ্টা করুন',
    stats: [
      { id: 'donationsTaka', label: 'দান করা টাকা' },
      { id: 'familiesHelped', label: 'সহায়তা পাওয়া পরিবার' },
      { id: 'activeVolunteers', label: 'সক্রিয় স্বেচ্ছাসেবক' },
      { id: 'reliefCampsOpen', label: 'চালু ত্রাণকেন্দ্র' },
    ],
  },
}

function ImpactStats() {
  const { i18n } = useTranslation()
  const statsRef = useRef(null)
  const [stats, setStats] = useState(getMockImpactStats)
  const [status, setStatus] = useState('demo')
  const [refreshKey, setRefreshKey] = useState(0)
  const [progress, setProgress] = useState(0)
  const hasStats = stats !== null
  const content = copy[i18n.language] || copy.en
  const isBangla = i18n.language === 'bn-BD'
  const locale = isBangla ? 'bn-BD' : 'en-BD'
  const integerFormatter = new Intl.NumberFormat(locale)
  const moneyFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const lakhFormatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const numberSize = isBangla
    ? 'text-[22px] sm:text-4xl md:text-[28px] lg:text-4xl xl:text-5xl'
    : 'text-3xl sm:text-4xl lg:text-5xl'
  const compactNumberSize = isBangla
    ? 'text-base sm:text-3xl md:text-lg lg:text-3xl xl:text-4xl'
    : 'text-lg sm:text-3xl md:text-xl lg:text-3xl xl:text-4xl'

  useEffect(() => {
    let controller
    let refreshTimer
    const load = async () => {
      window.clearTimeout(refreshTimer)
      controller?.abort()
      const current = new AbortController()
      controller = current
      try {
        const nextStats = await getImpactStats({ signal: current.signal })
        if (current.signal.aborted) return
        setStats(nextStats)
        setStatus('ready')
        refreshTimer = window.setTimeout(load, 60000)
      } catch {
        if (current.signal.aborted) return
        setStats(getMockImpactStats())
        setStatus('demo')
        refreshTimer = window.setTimeout(load, 15000)
      }
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      controller?.abort()
      window.clearTimeout(refreshTimer)
      window.removeEventListener('focus', load)
    }
  }, [refreshKey])

  useEffect(() => {
    const element = statsRef.current
    if (!element || !hasStats) return undefined
    const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let observer
    let animationFrame
    let started = false
    const showFinalValues = () => {
      started = true
      observer?.disconnect()
      window.cancelAnimationFrame(animationFrame)
      setProgress(1)
    }
    const startCounting = () => {
      if (started) return
      started = true
      observer?.disconnect()
      let startTime
      const tick = (time) => {
        startTime ??= time
        const elapsed = Math.min((time - startTime) / countDuration, 1)
        setProgress(1 - (1 - elapsed) ** 3)
        if (elapsed < 1) animationFrame = window.requestAnimationFrame(tick)
      }
      animationFrame = window.requestAnimationFrame(tick)
    }
    const handleMotionChange = (event) => {
      if (event.matches) showFinalValues()
    }
    if (motionPreference?.matches) {
      showFinalValues()
    } else if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.25)) startCounting()
      }, { threshold: 0.25 })
      observer.observe(element)
    } else {
      startCounting()
    }
    motionPreference?.addEventListener?.('change', handleMotionChange)
    return () => {
      observer?.disconnect()
      window.cancelAnimationFrame(animationFrame)
      motionPreference?.removeEventListener?.('change', handleMotionChange)
    }
  }, [hasStats])

  const formatCount = (id, position = progress) => {
    if (!stats) return '—'
    const value = stats[id] * position
    if (id !== 'donationsTaka') return integerFormatter.format(Math.floor(value))
    return stats.donationsTaka >= 100000
      ? `৳ ${lakhFormatter.format(value / 100000)}${isBangla ? ' লাখ' : 'L'}`
      : `৳ ${moneyFormatter.format(value)}`
  }
  const updatedAt = status === 'ready' && new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka',
  }).format(new Date(stats.updatedAt))

  return (
    <section
      aria-label={content.title}
      className="relative z-20 -mt-12 bg-[linear-gradient(to_bottom,transparent_48px,#f4f8f9_48px)] pb-6"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <dl
          aria-describedby="relief-impact-note"
          className="grid grid-cols-2 gap-x-4 gap-y-8 rounded-2xl border border-[#e2e8f0] bg-[#ffffff] px-5 py-8 text-center shadow-[0_2px_8px_rgba(15,46,68,0.06)] sm:px-8 md:grid-cols-4 md:gap-6 md:py-10"
          ref={statsRef}
        >
          {content.stats.map((stat) => {
            const finalValue = formatCount(stat.id, 1)
            const size = finalValue.length > (isBangla ? 10 : 7) ? compactNumberSize : numberSize
            return (
            <div className="flex min-w-0 flex-col items-center" key={stat.id}>
              <dt className="order-2 mt-2 text-sm leading-5 text-[#475569] md:text-base">{stat.label}</dt>
              <dd className={`order-1 m-0 whitespace-nowrap font-extrabold leading-none tracking-tight text-[#0c2e46] tabular-nums ${size}`}>
                <span className="sr-only">{finalValue}</span>
                <span aria-hidden="true" className="inline-grid">
                  <span className="invisible col-start-1 row-start-1">{finalValue}</span>
                  <span className="col-start-1 row-start-1">{formatCount(stat.id)}</span>
                </span>
              </dd>
            </div>
            )
          })}
        </dl>
        <p aria-live="polite" className="mt-3 text-center text-xs text-[#64748b]" id="relief-impact-note">
          {status === 'demo' ? content.demo
            : <>{content.updated} <time dateTime={stats.updatedAt}>{updatedAt}</time></>}
          {status === 'demo' && (
            <button className="ml-2 font-semibold underline underline-offset-2" onClick={() => setRefreshKey((key) => key + 1)} type="button">
              {content.retry}
            </button>
          )}
        </p>
      </div>
    </section>
  )
}

export default ImpactStats
