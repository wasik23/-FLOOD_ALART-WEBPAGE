import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSocket from '../hooks/useSocket.js'
import { getLiveDonations } from '../services/liveDonations.js'
import { getMockDonations } from '../data/mockReliefImpact.js'

const copy = {
  en: {
    title: 'Live donations', subtitle: 'Anonymous option available', anonymous: 'Anonymous',
    empty: 'No donations have been recorded yet.',
    demo: 'Mock data · waiting for backend', retry: 'Try again', justNow: 'Just now',
  },
  'bn-BD': {
    title: 'সাম্প্রতিক অনুদান', subtitle: 'নাম গোপন রাখার সুযোগ আছে', anonymous: 'অজ্ঞাতনামা',
    empty: 'এখনও কোনো অনুদান নথিভুক্ত হয়নি।',
    demo: 'নমুনা তথ্য · ব্যাকএন্ডের সংযোগের অপেক্ষায়', retry: 'আবার চেষ্টা করুন', justNow: 'এইমাত্র',
  },
}

function LiveDonations() {
  const { i18n } = useTranslation()
  const [donations, setDonations] = useState(getMockDonations)
  const [status, setStatus] = useState('demo')
  const [now, setNow] = useState(Date.now)
  const controllerRef = useRef(null)
  const content = copy[i18n.language] || copy.en
  const locale = i18n.language === 'bn-BD' ? 'bn-BD' : 'en-BD'
  const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' })

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestedAt = Date.now()
    setNow(requestedAt)
    try {
      const next = await getLiveDonations({ signal: controller.signal })
      if (controller.signal.aborted) return
      setDonations(next)
      setStatus('ready')
    } catch {
      if (controller.signal.aborted) return
      setDonations(getMockDonations(requestedAt))
      setStatus('demo')
    }
  }, [])

  useEffect(() => {
    load()
    const interval = window.setInterval(load, 15000)
    window.addEventListener('focus', load)
    return () => {
      controllerRef.current?.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const handlers = useMemo(() => ({ donation_update: load, connect: load }), [load])
  useSocket(handlers)

  const timeAgo = (receivedAt) => {
    const seconds = Math.max(0, Math.floor((now - new Date(receivedAt).getTime()) / 1000))
    if (seconds < 60) return content.justNow
    if (seconds < 3600) return relativeTime.format(-Math.floor(seconds / 60), 'minute')
    if (seconds < 86400) return relativeTime.format(-Math.floor(seconds / 3600), 'hour')
    return relativeTime.format(-Math.floor(seconds / 86400), 'day')
  }

  return (
    <section aria-labelledby="live-donations-title" className="bg-[#f4f8f9] pb-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#e2e8f0] bg-[#ffffff] p-5 shadow-[0_2px_8px_rgba(15,46,68,0.06)] sm:p-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0c2e46] sm:text-3xl" id="live-donations-title">{content.title}</h2>
          <p className="mt-2 text-sm text-[#6b7780] sm:text-base">{content.subtitle}</p>
          {status === 'ready' && donations?.length === 0 && <p className="py-10 text-sm text-[#6b7780]">{content.empty}</p>}
          {donations?.length > 0 && <ul className="mt-6 divide-y divide-[#e9eef0]">
            {donations.map((donation) => {
              const name = donation.displayName === 'Anonymous' ? content.anonymous : donation.displayName
              return <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-3 sm:gap-x-6" key={donation.id}>
                <span className="truncate text-base text-[#314b59] sm:text-lg" title={name}>{name}</span>
                <span className="text-right text-base font-semibold tabular-nums text-[#0c2e46] sm:text-center sm:text-lg">{money.format(Number(donation.amount))}৳</span>
                <time className="col-span-2 text-right text-xs text-[#6b7780] sm:col-span-1 sm:text-sm" dateTime={donation.receivedAt} title={date.format(new Date(donation.receivedAt))}>{timeAgo(donation.receivedAt)}</time>
              </li>
            })}
          </ul>}
          {status === 'demo' && <p className="mt-4 text-xs text-[#6b7780]" role="status">
            {content.demo}{' '}
            <button className="font-semibold text-[#0c2e46] underline underline-offset-2" onClick={load} type="button">{content.retry}</button>
          </p>}
        </div>
      </div>
    </section>
  )
}

export default LiveDonations
