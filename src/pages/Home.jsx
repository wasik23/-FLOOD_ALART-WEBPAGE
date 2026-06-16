import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getLiveWaterLevels } from '../services/ffwc.js'

const riskStyles = {
  Low: {
    badge: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/20',
    meter: 'bg-emerald-300',
    icon: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
    status: 'Falling',
    width: '30%',
  },
  Medium: {
    badge: 'bg-cyan-300/10 text-cyan-100 ring-cyan-300/20',
    meter: 'bg-cyan-200',
    icon: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    status: 'Stable',
    width: '56%',
  },
  High: {
    badge: 'bg-rose-300/10 text-rose-100 ring-rose-300/20',
    meter: 'bg-rose-200',
    icon: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    status: 'Rising',
    width: '78%',
  },
  Critical: {
    badge: 'bg-red-300/10 text-red-100 ring-red-300/20',
    meter: 'bg-red-200',
    icon: 'border-red-300/20 bg-red-300/10 text-red-100',
    status: 'Critical',
    width: '94%',
  },
}

function parseWaterLevel(value) {
  const parsed = Number.parseFloat(String(value || '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getWaterSafety(item) {
  const level = parseWaterLevel(item.level)
  const dangerLevel = parseWaterLevel(item.dangerLevel)

  if (level === null || dangerLevel === null) {
    return item.risk === 'Critical' || item.risk === 'High' ? 'danger' : 'safe'
  }

  return level >= dangerLevel ? 'danger' : 'safe'
}

const copyPropType = PropTypes.shape({
  contact: PropTypes.shape({
    body: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    eyebrow: PropTypes.string.isRequired,
    hotline: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
  forecast: PropTypes.shape({
    alerts: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
  hero: PropTypes.shape({
    donate: PropTypes.string.isRequired,
    request: PropTypes.string.isRequired,
    volunteer: PropTypes.string.isRequired,
  }).isRequired,
  nav: PropTypes.shape({
    contact: PropTypes.string.isRequired,
    forecast: PropTypes.string.isRequired,
    language: PropTypes.string.isRequired,
    map: PropTypes.string.isRequired,
    news: PropTypes.string.isRequired,
  }).isRequired,
  news: PropTypes.shape({
    eyebrow: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
})

const forecastCardPropType = PropTypes.shape({
  area: PropTypes.string,
  dangerLevel: PropTypes.string,
  district: PropTypes.string,
  level: PropTypes.string.isRequired,
  observedAt: PropTypes.string,
  risk: PropTypes.string,
  river: PropTypes.string.isRequired,
  station: PropTypes.string,
  trend: PropTypes.string,
})

const newsCardPropType = PropTypes.shape({
  area: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  summary: PropTypes.string.isRequired,
  time: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
})

const heroImages = [
  {
    alt: 'A person carrying belongings through Bangladesh floodwater',
    src: 'https://media-cldnry.s-nbcnews.com/image/upload/t_fit-1000w,f_auto,q_auto:best/rockcms/2024-08/240826-bangladesh-flooding-mb-0917-8c50f5.jpg',
  },
  {
    alt: 'A woman carrying a child through Bangladesh floodwater',
    src: '/images/flood-hero-family.webp',
  },
  {
    alt: 'Aerial view of Bangladesh floodwater surrounding homes',
    src: '/images/flood-hero-afp.jpg',
  },
  {
    alt: 'People traveling by boat through Bangladesh floodwater',
    src: '/images/flood-hero-boat.jpg',
  },
  {
    alt: 'A hand holding a relief heart symbol for flood support',
    src: '/images/flood-hero-rescue.jpg',
  },
]

const landingCopy = {
  en: {
    nav: {
      forecast: 'Water forecast',
      map: 'Live map',
      news: 'Flood news',
      contact: 'Contact',
      request: 'Request help',
      language: 'বাংলা',
    },
    hero: {
      eyebrow: 'Bangladesh flood relief',
      title: 'Fast help for people facing flood emergencies.',
      body:
        'Public users can view alerts, forecasts, donation details, and contact information without registration.',
      donate: 'Donate now',
      contact: 'Contact us',
      request: 'Request help',
      volunteer: 'Volunteer register',
    },
    forecast: {
      eyebrow: 'Water level forecast',
      title: 'Area-wise flood risk outlook',
      alerts: 'Get SMS alerts',
    },
    news: {
      eyebrow: 'Flood news',
      title: 'Latest response updates',
    },
    contact: {
      eyebrow: 'Contact us',
      title: 'Need urgent coordination?',
      body:
        'Call the relief desk, send shelter information, or reach out for donation verification.',
      hotline: 'Hotline',
      email: 'Email',
    },
    risks: {
      Low: 'Low',
      Medium: 'Medium',
      High: 'High',
      Critical: 'Critical',
    },
    forecasts: [
      {
        area: 'Sylhet Sadar',
        river: 'Surma',
        level: '13.8 m',
        trend: 'Rising',
        risk: 'Critical',
        forecast: 'May cross danger level within 12 hours.',
      },
      {
        area: 'Sunamganj',
        river: 'Kushiyara',
        level: '12.4 m',
        trend: 'Rising',
        risk: 'High',
        forecast: 'Low-lying unions should prepare evacuation support.',
      },
      {
        area: 'Kurigram',
        river: 'Brahmaputra',
        level: '19.2 m',
        trend: 'Stable',
        risk: 'Medium',
        forecast: 'Char areas may remain waterlogged through tomorrow.',
      },
      {
        area: 'Feni',
        river: 'Muhuri',
        level: '8.7 m',
        trend: 'Falling',
        risk: 'Low',
        forecast: 'Road access is improving; continue monitoring embankments.',
      },
    ],
    floodNews: [
      {
        id: 'news-sylhet-route',
        title: 'Relief route opened for Kanaighat shelters',
        area: 'Sylhet',
        time: 'Today, 9:30 AM',
        summary:
          'Volunteer teams reopened one road link and moved water purification tablets to three shelters.',
      },
      {
        id: 'news-sunamganj-boats',
        title: 'Boat support requested in low-lying villages',
        area: 'Sunamganj',
        time: 'Today, 8:15 AM',
        summary:
          'Local coordinators are prioritizing rescue boats, dry food, and medicine for families still cut off by floodwater.',
      },
      {
        id: 'news-kurigram-health',
        title: 'Mobile medical desk planned near char areas',
        area: 'Kurigram',
        time: 'Yesterday, 6:40 PM',
        summary:
          'Health volunteers are preparing ORS, fever medicine, and basic triage support for waterlogged communities.',
      },
    ],
  },
  'bn-BD': {
    nav: {
      map: 'লাইভ মানচিত্র',
      forecast: 'পানির পূর্বাভাস',
      news: 'বন্যার খবর',
      contact: 'যোগাযোগ',
      request: 'সহায়তা চান',
      login: 'এনজিও/অ্যাডমিন লগইন',
      language: 'English',
    },
    hero: {
      eyebrow: 'বাংলাদেশ বন্যা সহায়তা',
      title: 'বন্যা জরুরি অবস্থায় মানুষের পাশে দ্রুত সহায়তা।',
      body:
        'সাধারণ ব্যবহারকারীরা নিবন্ধন ছাড়াই সতর্কতা, পূর্বাভাস, অনুদানের তথ্য ও যোগাযোগ দেখতে পারবেন। মাঠকাজে যোগ দিতে স্বেচ্ছাসেবকদের আগে নিবন্ধন করতে হবে।',
      donate: 'এখনই অনুদান দিন',
      contact: 'যোগাযোগ করুন',
      request: 'সহায়তা চান',
      volunteer: 'স্বেচ্ছাসেবক নিবন্ধন',
    },
    forecast: {
      eyebrow: 'পানির স্তরের পূর্বাভাস',
      title: 'এলাকাভিত্তিক বন্যা ঝুঁকির চিত্র',
      alerts: 'এসএমএস সতর্কতা নিন',
    },
    news: {
      eyebrow: 'বন্যার খবর',
      title: 'সর্বশেষ সহায়তা আপডেট',
    },
    contact: {
      eyebrow: 'যোগাযোগ করুন',
      title: 'জরুরি সমন্বয় দরকার?',
      body:
        'ত্রাণ ডেস্কে কল করুন, আশ্রয়কেন্দ্রের তথ্য পাঠান, অথবা অনুদান যাচাইয়ের জন্য যোগাযোগ করুন।',
      hotline: 'হটলাইন',
      email: 'ইমেইল',
    },
    risks: {
      Low: 'কম',
      Medium: 'মাঝারি',
      High: 'উচ্চ',
      Critical: 'সংকটজনক',
    },
    forecasts: [
      {
        area: 'সিলেট সদর',
        river: 'সুরমা',
        level: '১৩.৮ মি',
        trend: 'বাড়ছে',
        risk: 'Critical',
        forecast: '১২ ঘণ্টার মধ্যে বিপদসীমা অতিক্রম করতে পারে।',
      },
      {
        area: 'সুনামগঞ্জ',
        river: 'কুশিয়ারা',
        level: '১২.৪ মি',
        trend: 'বাড়ছে',
        risk: 'High',
        forecast: 'নিম্নাঞ্চলের ইউনিয়নগুলোতে সরিয়ে নেওয়ার প্রস্তুতি দরকার।',
      },
      {
        area: 'কুড়িগ্রাম',
        river: 'ব্রহ্মপুত্র',
        level: '১৯.২ মি',
        trend: 'স্থিতিশীল',
        risk: 'Medium',
        forecast: 'চর এলাকায় আগামীকাল পর্যন্ত জলাবদ্ধতা থাকতে পারে।',
      },
      {
        area: 'ফেনী',
        river: 'মুহুরী',
        level: '৮.৭ মি',
        trend: 'কমছে',
        risk: 'Low',
        forecast: 'সড়ক যোগাযোগ উন্নত হচ্ছে; বাঁধ পর্যবেক্ষণ চালিয়ে যান।',
      },
    ],
    floodNews: [
      {
        id: 'news-sylhet-route',
        title: 'কানাইঘাট আশ্রয়কেন্দ্রে ত্রাণপথ চালু',
        area: 'সিলেট',
        time: 'আজ, সকাল ৯:৩০',
        summary:
          'স্বেচ্ছাসেবক দল একটি সড়কপথ চালু করে তিনটি আশ্রয়কেন্দ্রে পানি বিশুদ্ধকরণ ট্যাবলেট পৌঁছে দিয়েছে।',
      },
      {
        id: 'news-sunamganj-boats',
        title: 'নিম্নাঞ্চলীয় গ্রামে নৌকা সহায়তার অনুরোধ',
        area: 'সুনামগঞ্জ',
        time: 'আজ, সকাল ৮:১৫',
        summary:
          'পানিবন্দী পরিবারগুলোর জন্য উদ্ধার নৌকা, শুকনা খাবার ও ওষুধকে অগ্রাধিকার দিচ্ছেন স্থানীয় সমন্বয়কারীরা।',
      },
      {
        id: 'news-kurigram-health',
        title: 'চর এলাকায় মোবাইল মেডিকেল ডেস্কের পরিকল্পনা',
        area: 'কুড়িগ্রাম',
        time: 'গতকাল, সন্ধ্যা ৬:৪০',
        summary:
          'স্বাস্থ্য স্বেচ্ছাসেবকেরা ওআরএস, জ্বরের ওষুধ ও প্রাথমিক চিকিৎসা সহায়তার প্রস্তুতি নিচ্ছেন।',
      },
    ],
  },
}

function Home() {
  const { i18n } = useTranslation()
  const [heroImageIndex, setHeroImageIndex] = useState(0)
  const [liveWaterData, setLiveWaterData] = useState(null)
  const [waterDataStatus, setWaterDataStatus] = useState('loading')
  const language = i18n.language === 'bn-BD' ? 'bn-BD' : 'en'
  const copy = landingCopy[language]
  const forecastCards = liveWaterData?.waterLevels?.length
    ? liveWaterData.waterLevels.slice(0, 4)
    : copy.forecasts
  const liveNewsCards = liveWaterData?.waterLevels?.length
    ? liveWaterData.waterLevels.slice(0, 3).map((item) => ({
        id: `ffwc-${item.id}`,
        title: `${item.station} station is ${item.trend.toLowerCase()}`,
        area: item.district,
        time: item.observedAt || liveWaterData.lastUpdated || 'Latest FFWC update',
        summary: `${item.forecast} Current level is ${item.level}, danger level is ${item.dangerLevel}, and risk is ${item.risk.toLowerCase()}.`,
      }))
    : copy.floodNews

  const toggleLanguage = () => {
    i18n.changeLanguage(language === 'bn-BD' ? 'en' : 'bn-BD')
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % heroImages.length)
    }, 4000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    getLiveWaterLevels({ signal: controller.signal })
      .then((data) => {
        setLiveWaterData(data)
        setWaterDataStatus('live')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setWaterDataStatus('fallback')
        }
      })

    return () => controller.abort()
  }, [])

  return (
    <div className="min-h-screen bg-[#090f0f] text-slate-50">
      <LandingHeader copy={copy} onToggleLanguage={toggleLanguage} />
      <main>
        <HeroSection copy={copy} heroImageIndex={heroImageIndex} />
        <ForecastSection
          copy={copy}
          forecastCards={forecastCards}
          waterDataStatus={waterDataStatus}
        />
        <NewsSection
          copy={copy}
          liveNewsCards={liveNewsCards}
          waterDataStatus={waterDataStatus}
        />
        <ContactSection copy={copy} />
      </main>
      <LandingFooter />
    </div>
  )
}

function LandingHeader({ copy, onToggleLanguage }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0b1111]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3" to="/">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-300/10 bg-emerald-300/10">
            <img alt="" className="h-6 w-6" src="/reliefops-icon.svg" />
          </span>
          <span className="text-base font-extrabold text-white">ReliefOps</span>
        </Link>

        <nav className="order-3 flex w-full flex-wrap items-center justify-center gap-1 text-xs font-semibold text-slate-300 md:order-none md:w-auto">
          <a className="rounded-md px-3 py-2 text-emerald-300 underline decoration-emerald-300 underline-offset-8" href="#forecasts">
            {copy.nav.forecast}
          </a>
          <Link className="rounded-md px-3 py-2 hover:bg-white/[0.06] hover:text-white" to="/map">
            {copy.nav.map}
          </Link>
          <a className="rounded-md px-3 py-2 hover:bg-white/[0.06] hover:text-white" href="#news">
            {copy.nav.news}
          </a>
          <a className="rounded-md px-3 py-2 hover:bg-white/[0.06] hover:text-white" href="#contact">
            {copy.nav.contact}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link className="hidden items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.06] hover:text-white sm:inline-flex" to="/register">
            <VolunteerIcon />
            {copy.hero.volunteer}
          </Link>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.06]"
            onClick={onToggleLanguage}
            type="button"
          >
            {copy.nav.language}
          </button>
          <Link className="landing-button landing-button-sos rounded-md bg-[#ff5a61] px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-red-950/30 hover:bg-[#ff454f]" to="/request-help">
            SOS Help
          </Link>
        </div>
      </div>
    </header>
  )
}

function VolunteerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 7.9 11.3 7a2.8 2.8 0 0 0-4.1 3.8L12 15.5l4.8-4.7A2.8 2.8 0 0 0 12.7 7l-.7.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M3.5 13.5h2.4c1.1 0 2.1.4 2.9 1.2l1.4 1.3c.6.6 1.4.9 2.2.9h3.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M14.2 13.9h2.6c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1h-3.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m17.6 16.1 1.6-1.3a1.45 1.45 0 0 1 2 2.1l-2.5 2.3c-.6.5-1.3.8-2.1.8h-5.2c-.9 0-1.8-.3-2.5-1L6.7 17H3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M3.5 12v7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function SafetyStatusIcon({ status }) {
  if (status === 'danger') {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 4.5 21 20H3L12 4.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M12 9v5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M12 17.5h.01"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3.5 19 6v5.2c0 4.4-2.8 7.8-7 9.3-4.2-1.5-7-4.9-7-9.3V6l7-2.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m8.8 12 2.1 2.1 4.5-4.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function HeroSection({ copy, heroImageIndex }) {
  return (
    <section className="border-b border-white/[0.04] bg-[#0b1111]">
      <div className="mx-auto grid min-h-[760px] max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,0.95fr)_minmax(320px,1fr)] lg:px-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs font-bold uppercase tracking-normal text-red-100">
            <span className="h-2 w-2 rounded-full bg-red-200" />
            Critical alert: northern region
          </p>
          <h1 className="mt-7 max-w-xl text-5xl font-black leading-[0.98] text-slate-100 sm:text-6xl">
            Fast <span className="text-emerald-300">help</span> for people facing flood emergencies.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
            Real-time risk monitoring and emergency response coordination. We bridge the gap between distress and relief using live telemetry and community networks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="landing-button landing-button-primary rounded-lg bg-emerald-300 px-8 py-4 text-sm font-extrabold text-[#062018] shadow-xl shadow-emerald-950/20 hover:bg-emerald-200" to="/request-help">
              {copy.hero.request}
            </Link>
            <Link className="landing-button landing-button-donate rounded-lg border bg-white/[0.04] px-8 py-4 text-sm font-extrabold hover:bg-emerald-300/[0.08]" to="/donate">
              <span className="landing-glow-text">{copy.hero.donate}</span>
            </Link>
          </div>
          <div className="mt-9 grid max-w-md grid-cols-2 border-t border-white/[0.06] pt-8">
            <div className="border-r border-white/[0.06] pr-7">
              <p className="text-4xl font-black leading-none text-slate-100">24/7</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Active alerts</p>
            </div>
            <div className="pl-7">
              <p className="text-4xl font-black leading-none text-slate-100">1.2k+</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Relief cases</p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-white/[0.06] shadow-2xl shadow-black/40 sm:h-[560px]">
            {heroImages.map((image, index) => (
              <img
                alt={image.alt}
                className={[
                  'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out',
                  index === heroImageIndex ? 'opacity-100' : 'opacity-0',
                ].join(' ')}
                key={image.src}
                src={image.src}
              />
            ))}
            <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-[28px] bg-gradient-to-t from-[#0b1111] via-[#0b1111]/35 to-transparent" />
          </div>
          <div className="absolute -bottom-8 left-4 max-w-[230px] rounded-xl border border-white/10 bg-[#151c1c]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:left-[-30px]">
            <p className="flex items-center gap-2 text-sm font-extrabold text-white">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-emerald-300/30 text-xs text-emerald-200">*</span>
              Response Team
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              42 active rescue teams currently deployed in the Sylhet region.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ForecastSection({ copy, forecastCards, waterDataStatus }) {
  return (
    <section className="bg-[#080d0d] py-16 text-slate-100" id="forecasts">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
              {copy.forecast.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Visualizing current river basins and danger levels across the country through precision telemetry.
            </p>
          </div>
          <div className="inline-flex w-fit rounded-xl border border-white/10 bg-white/[0.08] p-1 text-xs font-bold">
            <span className="rounded-lg bg-emerald-300 px-5 py-3 text-[#062018]">Live Outlook</span>
            <Link className="landing-button rounded-lg px-5 py-3 text-slate-300 hover:text-white" to="/alerts">
              {copy.forecast.alerts}
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {forecastCards.map((item, index) => {
            const risk = riskStyles[item.risk] || riskStyles.Medium
            const location = item.area || item.district || item.station
            const basin = item.station ? `${item.station} station` : `${item.river} basin`
            const trend = item.trend || risk.status
            const safety = getWaterSafety(item)

            return (
              <article
                className="landing-risk-card rounded-3xl border border-white/[0.07] bg-[#121818] p-7 shadow-xl shadow-black/20"
                key={`${location}-${item.river}-${index}`}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-white">{location}</h3>
                    <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {basin}
                    </p>
                  </div>
                  <span
                    className={[
                      'landing-risk-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-lg font-black',
                      safety === 'danger'
                        ? 'border-red-300/35 bg-red-300/15 text-red-100'
                        : 'border-emerald-300/35 bg-emerald-300/15 text-emerald-200',
                    ].join(' ')}
                    title={safety === 'danger' ? 'Danger level reached' : 'Below danger level'}
                  >
                    <SafetyStatusIcon status={safety} />
                  </span>
                </div>

                <p className="mt-7 text-4xl font-black leading-none text-emerald-300">
                  {item.level}
                </p>
                <p className="mt-3 text-xs font-bold text-slate-300">
                  {item.dangerLevel ? `${item.dangerLevel} danger level` : 'Above danger level'}
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className={`landing-risk-meter h-full rounded-full ${risk.meter}`} style={{ width: risk.width }} />
                </div>
                <div className="mt-7 flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase">
                  <span className={`rounded-full px-3 py-1 ${risk.badge}`}>
                    {trend}
                  </span>
                  <span className="text-slate-500">
                    {item.observedAt || (index === 0 ? 'Just now' : `${(index + 1) * 3}m ago`)}
                  </span>
                </div>
              </article>
            )
          })}
        </div>

        <TelemetryTable forecastCards={forecastCards} waterDataStatus={waterDataStatus} />
      </div>
    </section>
  )
}

function TelemetryTable({ forecastCards, waterDataStatus }) {
  const feedLabel = waterDataStatus === 'live'
    ? 'Live system feed'
    : waterDataStatus === 'loading'
      ? 'Loading feed'
      : 'Fallback feed'

  return (
    <div className="landing-telemetry-panel mt-16 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#121818] shadow-2xl shadow-black/25">
      <div className="flex flex-col justify-between gap-3 border-b border-white/[0.06] bg-white/[0.04] px-6 py-6 sm:flex-row sm:items-center">
        <h3 className="text-xl font-black text-white">Live Sensor Telemetry</h3>
        <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">
          <span className="landing-live-dot h-2 w-2 rounded-full bg-emerald-300" />
          {feedLabel}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead className="border-b border-white/[0.05] text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-6 py-5">Station</th>
              <th className="px-6 py-5">River</th>
              <th className="px-6 py-5">Water Level</th>
              <th className="px-6 py-5">Trend</th>
              <th className="px-6 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {forecastCards.slice(0, 3).map((item, index) => {
              const risk = riskStyles[item.risk] || riskStyles.Medium
              const station = item.station || item.area || item.district

              return (
                <tr
                  className="landing-telemetry-row"
                  key={`${station}-${item.level}-${index}`}
                  style={{ animationDelay: `${220 + index * 90}ms` }}
                >
                  <td className="px-6 py-6 text-sm font-extrabold text-white">{station}</td>
                  <td className="px-6 py-6 text-sm text-slate-300">{item.river}</td>
                  <td className="px-6 py-6">
                    <span className="text-2xl font-black text-emerald-300">{item.level}</span>
                    {item.dangerLevel ? (
                      <span className="ml-2 text-xs text-slate-500">/ {item.dangerLevel} Danger</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-6">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${risk.badge}`}>
                      {item.trend || risk.status}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <Link className="text-xs font-extrabold text-emerald-300 hover:text-emerald-100" to="/map">
                      Analyze
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NewsSection({ copy, liveNewsCards, waterDataStatus }) {
  return (
    <section className="border-t border-white/[0.04] bg-[#080d0d] py-16" id="news">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
              {waterDataStatus === 'live' ? 'Live FFWC updates' : copy.news.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black text-white">
              {waterDataStatus === 'live'
                ? 'Latest water-level situation'
                : copy.news.title}
            </h2>
          </div>
          <Link className="landing-button w-fit rounded-lg border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/[0.06]" to="/alerts">
            View Alerts
          </Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {liveNewsCards.map((item) => (
            <article className="rounded-3xl border border-white/[0.07] bg-[#121818] p-6 shadow-xl shadow-black/20" key={item.id}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">
                {item.area} / {item.time}
              </p>
              <h3 className="mt-4 text-xl font-black leading-7 text-white">
                {item.title}
              </h3>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {item.summary}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContactSection({ copy }) {
  return (
    <section className="border-t border-white/[0.04] bg-[#0b1111] py-16" id="contact">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
            {copy.contact.eyebrow}
          </p>
          <h2 className="mt-3 max-w-lg text-3xl font-black text-white">{copy.contact.title}</h2>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            {copy.contact.body}
          </p>
        </div>
        <div className="grid gap-3">
          <a className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 text-sm font-extrabold text-white hover:bg-white/[0.07]" href="tel:01920065926">
            {copy.contact.hotline}: 01920065926
          </a>
          <a className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 text-sm font-extrabold text-white hover:bg-white/[0.07]" href="mailto:washique234@gmail.com">
            {copy.contact.email}: washique234@gmail.com
          </a>
        </div>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0b1111]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr] lg:px-8">
        <div>
          <Link className="flex items-center gap-3" to="/">
            <img alt="" className="h-7 w-7" src="/reliefops-icon.svg" />
            <span className="font-extrabold text-white">ReliefOps</span>
          </Link>
          <p className="mt-6 max-w-sm text-sm leading-7 text-slate-300">
            A unified emergency framework designed to provide high-precision flood intelligence and rapid response coordination for Bangladesh.
          </p>
        </div>
        <FooterLinks
          links={[
            { label: 'Emergency Dashboard', to: '/dashboard' },
            { label: 'Relief Centers', to: '/shelters' },
            { label: 'Volunteer Network', to: '/register' },
          ]}
          title="Platform"
        />
        <FooterLinks
          links={[
            { href: '#forecasts', label: 'Data Sources' },
            { label: 'API Access', to: '/alerts' },
            { href: '#contact', label: 'Safety Guides' },
          ]}
          title="Resources"
        />
        <div>
          <h3 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white">Newsletter</h3>
          <p className="mt-5 text-sm leading-6 text-slate-300">
            Receive critical weather updates and platform reports.
          </p>
          <form className="mt-5 flex gap-2" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="landing-newsletter-email">Email address</label>
            <input
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-300"
              id="landing-newsletter-email"
              placeholder="Email address"
              type="email"
            />
              <button className="landing-button landing-button-primary rounded-lg bg-emerald-300 px-4 py-3 text-sm font-black text-[#062018] hover:bg-emerald-200" type="submit">
                &gt;
              </button>
          </form>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <p>Copyright (c) 2026 belongs to washique234@gmail.com</p>
            <p>Contact: 01920065926</p>
          <p className="flex items-center gap-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Systems Operational
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLinks({ links, title }) {
  return (
    <div>
      <h3 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white">{title}</h3>
      <div className="mt-5 grid gap-3 text-sm text-slate-300">
        {links.map((link) => link.to ? (
          <Link className="hover:text-emerald-300" key={link.label} to={link.to}>
            {link.label}
          </Link>
        ) : (
          <a className="hover:text-emerald-300" href={link.href} key={link.label}>
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}

LandingHeader.propTypes = {
  copy: copyPropType.isRequired,
  onToggleLanguage: PropTypes.func.isRequired,
}

HeroSection.propTypes = {
  copy: copyPropType.isRequired,
  heroImageIndex: PropTypes.number.isRequired,
}

SafetyStatusIcon.propTypes = {
  status: PropTypes.oneOf(['safe', 'danger']).isRequired,
}

ForecastSection.propTypes = {
  copy: copyPropType.isRequired,
  forecastCards: PropTypes.arrayOf(forecastCardPropType).isRequired,
  waterDataStatus: PropTypes.string.isRequired,
}

TelemetryTable.propTypes = {
  forecastCards: PropTypes.arrayOf(forecastCardPropType).isRequired,
  waterDataStatus: PropTypes.string.isRequired,
}

NewsSection.propTypes = {
  copy: copyPropType.isRequired,
  liveNewsCards: PropTypes.arrayOf(newsCardPropType).isRequired,
  waterDataStatus: PropTypes.string.isRequired,
}

ContactSection.propTypes = {
  copy: copyPropType.isRequired,
}

FooterLinks.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      href: PropTypes.string,
      label: PropTypes.string.isRequired,
      to: PropTypes.string,
    }),
  ).isRequired,
  title: PropTypes.string.isRequired,
}

export default Home
