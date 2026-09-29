import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getLiveWaterLevels } from '../services/ffwc.js'

function ScrollReveal({ as: Element = 'div', children, className = '', delay = 0, style, ...props }) {
  const elementRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      return undefined
    }

    // Stop observing after entry so content does not replay on every scroll pass.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.unobserve(element)
      }
    }, { rootMargin: '0px 0px -32px 0px', threshold: 0.08 })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <Element
      {...props}
      className={['scroll-reveal', isVisible ? 'is-visible' : '', className].filter(Boolean).join(' ')}
      ref={elementRef}
      style={{ ...style, '--scroll-reveal-delay': `${delay}ms` }}
    >
      {children}
    </Element>
  )
}

ScrollReveal.propTypes = {
  as: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  delay: PropTypes.number,
  style: PropTypes.object,
}

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
    badge: 'bg-red-500/25 text-red-50 ring-red-300/40 shadow-lg shadow-red-950/25',
    meter: 'bg-gradient-to-r from-red-500 via-orange-400 to-red-300',
    icon: 'border-red-300/45 bg-red-500/20 text-red-50',
    status: 'Rising',
    width: '78%',
  },
  Critical: {
    badge: 'bg-red-600/35 text-white ring-red-200/45 shadow-lg shadow-red-950/35',
    meter: 'bg-gradient-to-r from-red-700 via-red-500 to-yellow-300',
    icon: 'border-red-200/60 bg-red-600/30 text-white shadow-lg shadow-red-950/30',
    status: 'Critical',
    width: '94%',
  },
}

function parseWaterLevel(value) {
  const bengaliDigits = '০১২৩৪৫৬৭৮৯'
  const normalized = String(value || '').replace(/[০-৯]/g, (digit) =>
    String(bengaliDigits.indexOf(digit)),
  )
  const parsed = Number.parseFloat(normalized.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getDangerPosition(item) {
  const level = parseWaterLevel(item.level)
  const dangerLevel = parseWaterLevel(item.dangerLevel)

  if (level === null || dangerLevel === null) return 'unknown'
  if (level > dangerLevel) return 'above'
  if (level < dangerLevel) return 'below'
  return 'at'
}

function getWaterSafety(item) {
  const position = getDangerPosition(item)
  if (position === 'above' || position === 'at') return 'danger'
  if (position === 'below') return 'safe'

  return item.risk === 'Critical' || item.risk === 'High' ? 'danger' : 'safe'
}

function getDangerSummary(item) {
  const level = parseWaterLevel(item.level)
  const dangerLevel = parseWaterLevel(item.dangerLevel)

  if (level === null || dangerLevel === null) {
    return item.risk
      ? `${item.risk} risk · danger threshold unavailable`
      : 'Danger threshold unavailable'
  }

  const difference = Math.abs(level - dangerLevel).toFixed(2)
  const threshold = item.dangerLevel
  const unit = String(item.level).includes('মি') ? 'মি' : 'm'
  const position = getDangerPosition(item)

  if (position === 'above') return `${difference} ${unit} above danger level (${threshold})`
  if (position === 'below') return `${difference} ${unit} below danger level (${threshold})`
  return `At danger level (${threshold})`
}

const riskWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 }

function compareForecastCards(first, second) {
  const safetyDifference =
    Number(getWaterSafety(second) === 'danger') -
    Number(getWaterSafety(first) === 'danger')
  if (safetyDifference) return safetyDifference

  return (riskWeight[second.risk] || 0) - (riskWeight[first.risk] || 0)
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
    showAll: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    sourceNote: PropTypes.string.isRequired,
    fallbackNote: PropTypes.string.isRequired,
    liveFeed: PropTypes.string.isRequired,
    telemetryTitle: PropTypes.string.isRequired,
    table: PropTypes.shape({
      action: PropTypes.string.isRequired,
      all: PropTypes.string.isRequired,
      analyze: PropTypes.string.isRequired,
      atDanger: PropTypes.string.isRequired,
      aboveDanger: PropTypes.string.isRequired,
      belowDanger: PropTypes.string.isRequired,
      filter: PropTypes.string.isRequired,
      model: PropTypes.string.isRequired,
      noForecast: PropTypes.string.isRequired,
      noResults: PropTypes.string.isRequired,
      matching: PropTypes.string.isRequired,
      next: PropTypes.string.isRequired,
      observed: PropTypes.string.isRequired,
      of: PropTypes.string.isRequired,
      previous: PropTypes.string.isRequired,
      river: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
      showForecast: PropTypes.string.isRequired,
      showing: PropTypes.string.isRequired,
      station: PropTypes.string.isRequired,
      stations: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      thresholdUnavailable: PropTypes.string.isRequired,
      trend: PropTypes.string.isRequired,
      waterLevel: PropTypes.string.isRequired,
    }).isRequired,
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
    liveEyebrow: PropTypes.string.isRequired,
    liveTitle: PropTypes.string.isRequired,
  }).isRequired,
})

const forecastCardPropType = PropTypes.shape({
  area: PropTypes.string,
  dangerLevel: PropTypes.string,
  district: PropTypes.string,
  forecastLevels: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      value: PropTypes.number,
    }),
  ),
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
      alert: 'Critical alert: northern region',
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
      showAll: 'Browse all stations',
      sourceNote: 'Latest field observations from FFWC at 06:00 Bangladesh time; readings may update once daily.',
      fallbackNote: 'Sample readings and danger thresholds are for display only; live FFWC data is unavailable.',
      liveFeed: 'Latest FFWC field observations',
      telemetryTitle: 'Latest FFWC water levels',
      table: {
        action: 'Action',
        all: 'All stations',
        analyze: 'Analyze',
        atDanger: 'At danger level',
        aboveDanger: 'Above danger',
        belowDanger: 'Below danger',
        filter: 'Filter by danger status',
        model: 'Model',
        noForecast: 'No forecast data',
        noResults: 'No stations match these filters.',
        matching: 'matching stations',
        next: 'Next',
        observed: 'Observed at',
        of: 'of',
        previous: 'Previous',
        river: 'River',
        search: 'Search station, area, or river',
        showForecast: '5-day forecast',
        showing: 'Showing',
        station: 'Station',
        stations: 'stations',
        status: 'Danger status',
        thresholdUnavailable: 'Threshold unavailable',
        trend: 'Trend',
        waterLevel: 'Water level',
      },
    },
    news: {
      eyebrow: 'Flood news',
      liveEyebrow: 'Latest FFWC readings',
      liveTitle: 'Latest water-level situation',
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
        dangerLevel: '13.0 mMSL',
        trend: 'Rising',
        risk: 'Critical',
        forecast: 'May cross danger level within 12 hours.',
      },
      {
        area: 'Sunamganj',
        river: 'Kushiyara',
        level: '12.4 m',
        dangerLevel: '11.8 mMSL',
        trend: 'Rising',
        risk: 'High',
        forecast: 'Low-lying unions should prepare evacuation support.',
      },
      {
        area: 'Kurigram',
        river: 'Brahmaputra',
        level: '19.2 m',
        dangerLevel: '20.0 mMSL',
        trend: 'Stable',
        risk: 'Medium',
        forecast: 'Char areas may remain waterlogged through tomorrow.',
      },
      {
        area: 'Feni',
        river: 'Muhuri',
        level: '8.7 m',
        dangerLevel: '9.5 mMSL',
        trend: 'Falling',
        risk: 'Low',
        forecast: 'Road access is improving; continue monitoring embankments.',
      },
      {
        area: 'Jamalpur',
        river: 'Old Brahmaputra',
        level: '6.1 m',
        dangerLevel: '5.9 mMSL',
        trend: 'Rising',
        risk: 'High',
        forecast: 'Water is nearing the danger mark; keep evacuation teams ready.',
      },
      {
        area: 'Gaibandha',
        river: 'Teesta',
        level: '5.4 m',
        dangerLevel: '5.3 mMSL',
        trend: 'Rising',
        risk: 'High',
        forecast: 'Rising water may affect low-lying unions overnight.',
      },
      {
        area: 'Bogra',
        river: 'Jamuna',
        level: '4.9 m',
        dangerLevel: '5.1 mMSL',
        trend: 'Stable',
        risk: 'Medium',
        forecast: 'Monitor embankments and keep relief routes clear.',
      },
      {
        area: 'Chandpur',
        river: 'Meghna',
        level: '3.8 m',
        dangerLevel: '4.0 mMSL',
        trend: 'Falling',
        risk: 'Low',
        forecast: 'Levels are easing; continue checking riverbank areas.',
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
      alert: 'উত্তরাঞ্চলে জরুরি বন্যা সতর্কতা',
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
      showAll: 'সব স্টেশন দেখুন',
      sourceNote: 'এফএফডব্লিউসি-এর সকাল ৬টার সর্বশেষ মাঠপর্যায়ের পর্যবেক্ষণ; তথ্য দিনে একবার হালনাগাদ হতে পারে।',
      fallbackNote: 'ডেমো পাঠ ও বিপদসীমা শুধু নমুনা; লাইভ এফএফডব্লিউসি তথ্য পাওয়া যাচ্ছে না।',
      liveFeed: 'এফএফডব্লিউসি-এর সর্বশেষ পর্যবেক্ষণ',
      telemetryTitle: 'এফএফডব্লিউসি-এর সর্বশেষ পানির স্তর',
      table: {
        action: 'কাজ',
        all: 'সব স্টেশন',
        analyze: 'বিশ্লেষণ',
        atDanger: 'বিপদসীমায়',
        aboveDanger: 'বিপদসীমার ওপরে',
        belowDanger: 'বিপদসীমার নিচে',
        filter: 'বিপদসীমা অনুযায়ী বাছাই',
        model: 'মডেল',
        noForecast: 'পূর্বাভাস নেই',
        noResults: 'এই বাছাইয়ে কোনো স্টেশন পাওয়া যায়নি।',
        matching: 'টি মিলে যাওয়া স্টেশন',
        next: 'পরের পৃষ্ঠা',
        observed: 'পর্যবেক্ষণের সময়',
        of: 'এর মধ্যে',
        previous: 'আগের পৃষ্ঠা',
        river: 'নদী',
        search: 'স্টেশন, এলাকা বা নদী খুঁজুন',
        showForecast: '৫ দিনের পূর্বাভাস',
        showing: 'দেখানো হচ্ছে',
        station: 'স্টেশন',
        stations: 'টি স্টেশন',
        status: 'বিপদসীমার অবস্থা',
        thresholdUnavailable: 'বিপদসীমার তথ্য নেই',
        trend: 'ধারা',
        waterLevel: 'পানির স্তর',
      },
    },
    news: {
      eyebrow: 'বন্যার খবর',
      liveEyebrow: 'এফএফডব্লিউসি-এর সর্বশেষ পাঠ',
      liveTitle: 'পানির স্তরের সর্বশেষ পরিস্থিতি',
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
        dangerLevel: '১৩.০ মিMSL',
        trend: 'বাড়ছে',
        risk: 'Critical',
        forecast: '১২ ঘণ্টার মধ্যে বিপদসীমা অতিক্রম করতে পারে।',
      },
      {
        area: 'সুনামগঞ্জ',
        river: 'কুশিয়ারা',
        level: '১২.৪ মি',
        dangerLevel: '১১.৮ মিMSL',
        trend: 'বাড়ছে',
        risk: 'High',
        forecast: 'নিম্নাঞ্চলের ইউনিয়নগুলোতে সরিয়ে নেওয়ার প্রস্তুতি দরকার।',
      },
      {
        area: 'কুড়িগ্রাম',
        river: 'ব্রহ্মপুত্র',
        level: '১৯.২ মি',
        dangerLevel: '২০.০ মিMSL',
        trend: 'স্থিতিশীল',
        risk: 'Medium',
        forecast: 'চর এলাকায় আগামীকাল পর্যন্ত জলাবদ্ধতা থাকতে পারে।',
      },
      {
        area: 'ফেনী',
        river: 'মুহুরী',
        level: '৮.৭ মি',
        dangerLevel: '৯.৫ মিMSL',
        trend: 'কমছে',
        risk: 'Low',
        forecast: 'সড়ক যোগাযোগ উন্নত হচ্ছে; বাঁধ পর্যবেক্ষণ চালিয়ে যান।',
      },
      {
        area: 'জামালপুর',
        river: 'পুরাতন ব্রহ্মপুত্র',
        level: '৬.১ মি',
        dangerLevel: '৫.৯ মিMSL',
        trend: 'বাড়ছে',
        risk: 'High',
        forecast: 'পানি বিপদসীমার কাছাকাছি; সরিয়ে নেওয়ার দল প্রস্তুত রাখুন।',
      },
      {
        area: 'গাইবান্ধা',
        river: 'তিস্তা',
        level: '৫.৪ মি',
        dangerLevel: '৫.৩ মিMSL',
        trend: 'বাড়ছে',
        risk: 'High',
        forecast: 'পানি বাড়লে রাতে নিম্নাঞ্চলের ইউনিয়ন প্লাবিত হতে পারে।',
      },
      {
        area: 'বগুড়া',
        river: 'যমুনা',
        level: '৪.৯ মি',
        dangerLevel: '৫.১ মিMSL',
        trend: 'স্থিতিশীল',
        risk: 'Medium',
        forecast: 'বাঁধ পর্যবেক্ষণ করুন এবং ত্রাণপথ চলাচলের উপযোগী রাখুন।',
      },
      {
        area: 'চাঁদপুর',
        river: 'মেঘনা',
        level: '৩.৮ মি',
        dangerLevel: '৪.০ মিMSL',
        trend: 'কমছে',
        risk: 'Low',
        forecast: 'পানির স্তর কমছে; নদীতীরবর্তী এলাকা পর্যবেক্ষণ চালিয়ে যান।',
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
  const forecastCards = (liveWaterData?.waterLevels?.length
    ? liveWaterData.waterLevels
    : copy.forecasts
  ).slice().sort(compareForecastCards)
  const liveNewsCards = liveWaterData?.waterLevels?.length
    ? liveWaterData.waterLevels.slice(0, 3).map((item) => ({
        id: `ffwc-${item.id}`,
        title: `${item.station} station is ${item.trend.toLowerCase()}`,
        area: item.district || item.area || item.station,
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
          <p className="inline-flex items-center gap-2 rounded-full border border-red-200/45 bg-red-600/25 px-3 py-2 text-xs font-black uppercase tracking-normal text-white shadow-lg shadow-red-950/35">
            <span className="h-2 w-2 rounded-full bg-red-100 shadow-[0_0_14px_rgb(254_202_202/0.9)]" />
            {copy.hero.alert}
          </p>
          <h1 className="mt-7 max-w-xl text-5xl font-black leading-[0.98] text-slate-100 sm:text-6xl">
            {copy.hero.title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
            {copy.hero.body}
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
  const visibleForecastCards = forecastCards.slice(0, 4)

  return (
    <ScrollReveal as="section" className="bg-[#080d0d] py-16 text-slate-100" id="forecasts">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
              {copy.forecast.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              {waterDataStatus === 'live' ? copy.forecast.sourceNote : copy.forecast.fallbackNote}
            </p>
          </div>
          <div className="inline-flex w-fit rounded-xl border border-white/10 bg-white/[0.08] p-1 text-xs font-bold">
            <span className="rounded-lg bg-emerald-300 px-5 py-3 text-[#062018]">Live Outlook</span>
            <Link className="landing-button rounded-lg px-5 py-3 text-slate-300 hover:text-white" to="/alerts">
              {copy.forecast.alerts}
            </Link>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {visibleForecastCards.map((item, index) => {
            const risk = riskStyles[item.risk] || riskStyles.Medium
            const location = item.area || item.district || item.station
            const basin = item.station ? `${item.station} station` : `${item.river} basin`
            const trend = item.trend || risk.status
            const safety = getWaterSafety(item)

            return (
              <ScrollReveal
                as="article"
                className={[
                  'landing-risk-card rounded-3xl p-7 shadow-xl',
                  safety === 'danger'
                    ? 'border border-red-300/35 bg-[linear-gradient(160deg,rgb(45_12_16/0.92),rgb(18_24_24/0.96)_58%)] shadow-red-950/30'
                    : 'border border-white/[0.07] bg-[#121818] shadow-black/20',
                ].join(' ')}
                key={`${location}-${item.river}-${index}`}
                delay={Math.min(index * 135, 405)}
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
                        ? risk.icon
                        : 'border-emerald-300/35 bg-emerald-300/15 text-emerald-200',
                    ].join(' ')}
                    title={getDangerSummary(item)}
                  >
                    <SafetyStatusIcon status={safety} />
                  </span>
                </div>

                <p className={[
                  'mt-7 text-4xl font-black leading-none',
                  safety === 'danger' ? 'text-red-200 drop-shadow-[0_0_16px_rgb(248_113_113/0.18)]' : 'text-emerald-300',
                ].join(' ')}>
                  {item.level}
                </p>
                <p className={['mt-3 text-xs font-bold', safety === 'danger' ? 'text-red-100' : 'text-slate-300'].join(' ')}>
                  {getDangerSummary(item)}
                </p>
                <div className={['mt-5 h-2 overflow-hidden rounded-full', safety === 'danger' ? 'bg-red-950/60' : 'bg-white/[0.05]'].join(' ')}>
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
              </ScrollReveal>
            )
          })}
        </div>

        {forecastCards.length > 4 ? (
          <div className="mt-7 flex justify-center">
            <a
              className="landing-button inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/[0.08]"
              href="#telemetry"
            >
              {copy.forecast.showAll}
              <span className="text-emerald-300">{forecastCards.length} {copy.forecast.table.stations}</span>
            </a>
          </div>
        ) : null}

        <TelemetryTable copy={copy} forecastCards={forecastCards} waterDataStatus={waterDataStatus} />
      </div>
    </ScrollReveal>
  )
}

function TelemetryTable({ copy, forecastCards, waterDataStatus }) {
  const labels = copy.forecast.table
  const [search, setSearch] = useState('')
  const [dangerFilter, setDangerFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 5
  const feedLabel = waterDataStatus === 'live'
    ? copy.forecast.liveFeed
    : waterDataStatus === 'loading'
      ? 'Loading feed'
      : 'Fallback feed'
  const normalizedSearch = search.trim().toLowerCase()
  const filteredStations = forecastCards.filter((item) => {
    const position = getDangerPosition(item)
    const matchesFilter = dangerFilter === 'all' || position === dangerFilter
    const matchesSearch = !normalizedSearch ||
      [item.station, item.area, item.district, item.river, item.basin]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))

    return matchesFilter && matchesSearch
  })
  const pageCount = Math.max(1, Math.ceil(filteredStations.length / rowsPerPage))
  const page = Math.min(currentPage, pageCount)
  const firstRow = filteredStations.length ? (page - 1) * rowsPerPage + 1 : 0
  const lastRow = Math.min(page * rowsPerPage, filteredStations.length)
  const pageStations = filteredStations.slice(firstRow - 1, lastRow)

  return (
    <ScrollReveal as="div" className="landing-telemetry-panel mt-16 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#121818] shadow-2xl shadow-black/25" id="telemetry">
      <div className="flex flex-col justify-between gap-3 border-b border-white/[0.06] bg-white/[0.04] px-6 py-6 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-black text-white">{copy.forecast.telemetryTitle}</h3>
          <p className="mt-2 text-xs text-slate-400">
            {forecastCards.length} {labels.stations}
          </p>
        </div>
        <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">
          <span className="landing-live-dot h-2 w-2 rounded-full bg-emerald-300" />
          {feedLabel}
        </p>
      </div>
      <div className="flex flex-col gap-3 border-b border-white/[0.05] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <label className="sr-only" htmlFor="ffwc-station-search">{labels.search}</label>
        <input
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-300 sm:max-w-sm"
          id="ffwc-station-search"
          onChange={(event) => {
            setSearch(event.target.value)
            setCurrentPage(1)
          }}
          placeholder={labels.search}
          type="search"
          value={search}
        />
        <label className="sr-only" htmlFor="ffwc-danger-filter">{labels.filter}</label>
        <select
          className="w-full rounded-xl border border-white/10 bg-[#101616] px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-300 sm:w-auto"
          id="ffwc-danger-filter"
          onChange={(event) => {
            setDangerFilter(event.target.value)
            setCurrentPage(1)
          }}
          value={dangerFilter}
        >
          <option value="all">{labels.all}</option>
          <option value="above">{labels.aboveDanger}</option>
          <option value="below">{labels.belowDanger}</option>
          <option value="at">{labels.atDanger}</option>
          <option value="unknown">{labels.thresholdUnavailable}</option>
        </select>
        <p className="shrink-0 text-xs text-slate-400">
          {filteredStations.length} {labels.matching}
        </p>
      </div>
      <div
        aria-label={copy.forecast.telemetryTitle}
        className="landing-telemetry-scroll overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <table className="w-full min-w-[980px] text-left">
          <thead className="border-b border-white/[0.05] text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-6 py-5">{labels.station}</th>
              <th className="px-6 py-5">{labels.river}</th>
              <th className="px-6 py-5">{labels.waterLevel}</th>
              <th className="px-6 py-5">{labels.status}</th>
              <th className="px-6 py-5">{labels.trend}</th>
              <th className="px-6 py-5">{labels.model} · {labels.waterLevel}</th>
              <th className="px-6 py-5">{labels.observed}</th>
              <th className="px-6 py-5 text-right">{labels.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {pageStations.map((item, index) => {
              const risk = riskStyles[item.risk] || riskStyles.Medium
              const station = item.station || item.area || item.district
              const position = getDangerPosition(item)
              const positionLabel = position === 'above'
                ? labels.aboveDanger
                : position === 'below'
                  ? labels.belowDanger
                  : position === 'at'
                    ? labels.atDanger
                    : labels.thresholdUnavailable
              const positionColor = position === 'above' || position === 'at'
                ? 'bg-red-500/15 text-red-200'
                : position === 'below'
                  ? 'bg-emerald-400/10 text-emerald-200'
                  : 'bg-white/[0.08] text-slate-300'

              return (
                <ScrollReveal
                  as="tr"
                  className="landing-telemetry-row"
                  key={`${station}-${item.level}-${index}`}
                  delay={Math.min(index * 55, 220)}
                >
                  <td className="px-6 py-5 text-sm font-extrabold text-white">
                    {station}
                    {item.area && item.area !== station ? (
                      <span className="mt-1 block text-xs font-normal text-slate-500">{item.area}</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-300">
                    {item.river}
                    {item.basin ? (
                      <span className="mt-1 block text-xs text-slate-500">{item.basin}</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-lg font-black text-emerald-300">{item.level}</span>
                    {item.dangerLevel ? (
                      <span className="mt-1 block text-xs text-slate-500">Danger: {item.dangerLevel}</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${positionColor}`}>
                      {positionLabel}
                    </span>
                    <span className="mt-2 block text-xs text-slate-500">{getDangerSummary(item)}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${risk.badge}`}>
                      {item.trend || risk.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {item.forecastLevels?.some((forecast) => Number.isFinite(forecast.value)) ? (
                      <details className="min-w-36">
                        <summary className="cursor-pointer text-sm font-bold text-cyan-200">
                          {labels.showForecast}
                        </summary>
                        <div className="mt-3 grid gap-2">
                          {item.forecastLevels.map((forecast) => {
                            const forecastAboveDanger =
                              Number.isFinite(forecast.value) &&
                              forecast.value >= parseWaterLevel(item.dangerLevel)

                            return (
                              <p
                                className={`flex justify-between gap-3 text-xs ${forecastAboveDanger ? 'text-red-200' : 'text-slate-300'}`}
                                key={forecast.date}
                              >
                                <span>{forecast.date}</span>
                                <span className="font-bold">
                                  {Number.isFinite(forecast.value)
                                    ? `${forecast.value.toFixed(2)} mMSL`
                                    : labels.noForecast}
                                </span>
                              </p>
                            )
                          })}
                        </div>
                      </details>
                    ) : (
                      <span className="text-xs text-slate-500">{labels.noForecast}</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-xs text-slate-400">{item.observedAt || '—'}</td>
                  <td className="px-6 py-5 text-right">
                    <Link className="text-xs font-extrabold text-emerald-300 hover:text-emerald-100" to="/map">
                      {labels.analyze}
                    </Link>
                  </td>
                </ScrollReveal>
              )
            })}
            {!pageStations.length ? (
              <tr>
                <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan={8}>
                  {labels.noResults}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-white/[0.05] px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-slate-400">
          {labels.showing} {firstRow}–{lastRow} {labels.of} {filteredStations.length}
        </p>
        <div className="flex items-center gap-3">
          <button
            className="landing-button rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setCurrentPage(page - 1)}
            type="button"
          >
            {labels.previous}
          </button>
          <span className="text-xs text-slate-400">{page} / {pageCount}</span>
          <button
            className="landing-button rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= pageCount}
            onClick={() => setCurrentPage(page + 1)}
            type="button"
          >
            {labels.next}
          </button>
        </div>
      </div>
    </ScrollReveal>
  )
}

function NewsSection({ copy, liveNewsCards, waterDataStatus }) {
  const renderNewsGroup = (isDuplicate) => (
    <div
      aria-hidden={isDuplicate}
      className={isDuplicate ? 'flood-news-group flood-news-group-duplicate' : 'flood-news-group'}
      key={isDuplicate ? 'duplicate' : 'primary'}
    >
      {liveNewsCards.map((item) => (
        <article className="flood-news-card" key={item.id}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">
            {item.area} <span aria-hidden="true">/</span> {item.time}
          </p>
          <h3 className="mt-3 text-lg font-black leading-6 text-white">
            {item.title}
          </h3>
          <p className="mt-2 text-sm leading-5 text-slate-300">
            {item.summary}
          </p>
        </article>
      ))}
    </div>
  )

  return (
    <ScrollReveal as="section" className="border-t border-white/[0.04] bg-[#080d0d] py-16" id="news">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
              {waterDataStatus === 'live' ? copy.news.liveEyebrow : copy.news.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black text-white">
              {waterDataStatus === 'live' ? copy.news.liveTitle : copy.news.title}
            </h2>
          </div>
          <Link className="landing-button w-fit rounded-lg border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/[0.06]" to="/alerts">
            View Alerts
          </Link>
        </div>
        <div
          aria-label={copy.news.eyebrow}
          className="flood-news-marquee mt-8"
          role="region"
          tabIndex={0}
        >
          <div className="flood-news-track">
            {renderNewsGroup(false)}
            {renderNewsGroup(true)}
          </div>
        </div>
      </div>
    </ScrollReveal>
  )
}

function ContactSection({ copy }) {
  return (
    <ScrollReveal as="section" className="border-t border-white/[0.04] bg-[#0b1111] py-16" id="contact">
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
    </ScrollReveal>
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
  copy: copyPropType.isRequired,
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
