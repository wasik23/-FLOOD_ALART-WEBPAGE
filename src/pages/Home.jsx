import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BrandHeader from '../components/BrandHeader.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import { getLiveWaterLevels } from '../services/ffwc.js'

const riskStyles = {
  Low: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
}

const landingCopy = {
  en: {
    nav: {
      forecast: 'Water forecast',
      map: 'Live map',
      news: 'Flood news',
      contact: 'Contact',
      request: 'Request help',
      login: 'NGO/Admin login',
      language: 'বাংলা',
    },
    hero: {
      eyebrow: 'Bangladesh flood relief',
      title: 'Fast help for people facing flood emergencies.',
      body:
        'Public users can view alerts, forecasts, donation details, and contact information without registration. Volunteers register before joining field work.',
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
    <div className="min-h-screen bg-slate-950 text-white">
      <BrandHeader>
        <a className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" href="#forecasts">
          {copy.nav.forecast}
        </a>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/map">
          {copy.nav.map}
        </Link>
        <a className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" href="#news">
          {copy.nav.news}
        </a>
        <a className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" href="#contact">
          {copy.nav.contact}
        </a>
        <Link className="rounded-md bg-accent px-3 py-2 text-white" to="/request-help">
          {copy.nav.request}
        </Link>
        <Link className="rounded-md bg-white px-3 py-2 text-sky-800" to="/login">
          {copy.nav.login}
        </Link>
        <button
          className="rounded-md border border-white/40 px-3 py-2 text-white hover:bg-white/10"
          onClick={toggleLanguage}
          type="button"
        >
          {copy.nav.language}
        </button>
      </BrandHeader>

      <main>
        <section className="relative min-h-[78vh] overflow-hidden">
          <img
            alt="Flood relief volunteers helping a community"
            className="absolute inset-0 h-full w-full object-cover opacity-55"
            src="https://media-cldnry.s-nbcnews.com/image/upload/t_fit-1000w,f_auto,q_auto:best/rockcms/2024-08/240826-bangladesh-flooding-mb-0917-8c50f5.jpg"
          />
          <div className="absolute inset-0 bg-slate-950/65" />
          <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-200">
              {copy.hero.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight sm:text-6xl">
              {copy.hero.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              {copy.hero.body}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary bg-accent hover:bg-accent-600" to="/request-help">
                {copy.hero.request}
              </Link>
              <Link className="button-primary" to="/donate">
                {copy.hero.donate}
              </Link>
              <a className="button-secondary border-white/40 text-white hover:bg-white/10" href="#contact">
                {copy.hero.contact}
              </a>
              <Link className="button-secondary border-white/40 text-white hover:bg-white/10" to="/register">
                {copy.hero.volunteer}
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-12 text-slate-900" id="forecasts">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  {copy.forecast.eyebrow}
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-950">
                  {copy.forecast.title}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {waterDataStatus === 'live'
                    ? `Live FFWC data${
                        liveWaterData?.lastUpdated
                          ? ` | Updated ${liveWaterData.lastUpdated}`
                          : ''
                      }`
                    : waterDataStatus === 'loading'
                      ? 'Loading live FFWC water levels...'
                      : 'Showing saved fallback data while live data is unavailable.'}
                </p>
              </div>
              <Link className="button-secondary self-start md:self-auto" to="/alerts">
                {copy.forecast.alerts}
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {forecastCards.map((item) => (
                <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft" key={item.area}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{item.area}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {item.station ? `${item.station} | ${item.river}` : item.river}
                      </p>
                    </div>
                    <span className={`rounded-md px-2 py-1 text-xs font-bold ${riskStyles[item.risk]}`}>
                      {copy.risks[item.risk]}
                    </span>
                  </div>
                  <p className="mt-5 text-3xl font-bold text-primary">{item.level}</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">{item.trend}</p>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{item.forecast}</p>
                  {item.dangerLevel ? (
                    <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                      Danger level: {item.dangerLevel}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-12 text-slate-900" id="news">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {waterDataStatus === 'live' ? 'Live FFWC updates' : copy.news.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">
              {waterDataStatus === 'live'
                ? 'Latest water-level situation'
                : copy.news.title}
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {liveNewsCards.map((item) => (
                <article className="rounded-lg border border-primary-100 bg-slate-50 p-5" key={item.id}>
                  <p className="text-xs font-bold uppercase tracking-wide text-accent-700">
                    {item.area} | {item.time}
                  </p>
                  <h3 className="mt-3 text-xl font-bold leading-7 text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.summary}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary-900 py-12" id="contact">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-accent-200">
                {copy.contact.eyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-bold">{copy.contact.title}</h2>
              <p className="mt-4 leading-7 text-primary-50">
                {copy.contact.body}
              </p>
            </div>
            <div className="grid gap-3 text-primary-50">
              <a className="rounded-md border border-white/15 bg-white/10 p-4 font-bold" href="tel:01920065926">
                {copy.contact.hotline}: 01920065926
              </a>
              <a className="rounded-md border border-white/15 bg-white/10 p-4 font-bold" href="mailto:washique234@gmail.com">
                {copy.contact.email}: washique234@gmail.com
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

export default Home
