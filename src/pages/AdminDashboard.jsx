import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { ROLES } from '../auth/roles.js'
import {
  getDonationAccounts,
  getHelpRequests,
  getVolunteerProfiles,
} from '../data/reliefData.js'
import { getDistrictFloodRisk, getDistrictName, riskLevels } from '../utils/floodRisk.js'
import { createBangladeshMap } from '../utils/map.js'

const USERS_KEY = 'mock_auth_users'
const ADMIN_USER_OPS_KEY = 'admin_user_ops'
const ADMIN_DISTRICT_RISKS_KEY = 'admin_district_risks'
const ADMIN_SMS_SENT_KEY = 'admin_sms_sent'
const ADMIN_AUDIT_LOG_KEY = 'admin_audit_log'
const ADMIN_OWNER_SETTINGS_KEY = 'admin_owner_settings'

const fallbackUsers = [
  {
    id: 'usr_volunteer',
    name: 'Volunteer User',
    email: 'volunteer@example.com',
    password: 'password',
    role: ROLES.VOLUNTEER,
  },
  {
    id: 'usr_coordinator',
    name: 'NGO Coordinator',
    email: 'coordinator@example.com',
    password: 'password',
    role: ROLES.NGO,
  },
  {
    id: 'usr_admin',
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password',
    role: ROLES.ADMIN,
  },
]

const densityLegend = [
  { label: '0-39', color: '#DBEAFE', max: 39 },
  { label: '40-89', color: '#86EFAC', max: 89 },
  { label: '90-149', color: '#FACC15', max: 149 },
  { label: '150-219', color: '#FB923C', max: 219 },
  { label: '220+', color: '#EF4444', max: Number.POSITIVE_INFINITY },
]

const statusStyles = {
  Active: 'bg-green-100 text-green-800',
  Banned: 'bg-red-100 text-red-800',
}

const healthStyles = {
  Online: 'bg-green-100 text-green-800',
  Connected: 'bg-green-100 text-green-800',
  Ready: 'bg-green-100 text-green-800',
  Checking: 'bg-amber-100 text-amber-800',
  Pending: 'bg-amber-100 text-amber-800',
  Offline: 'bg-red-100 text-red-800',
  Error: 'bg-red-100 text-red-800',
}

const defaultOwnerSettings = {
  hotline: '999',
  donationStatus: 'Open',
  smsMode: 'Dry run',
  publicNotice:
    'ReliefOps is accepting verified flood relief requests and emergency donations.',
}

const defaultAuditLog = [
  {
    id: 'audit_seed',
    action: 'Owner console ready',
    details: 'NGO approval, donation oversight, and broadcast tools are available.',
    createdAt: new Date().toISOString(),
  },
]

function readJson(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function readAuditLog() {
  const log = readJson(ADMIN_AUDIT_LOG_KEY, defaultAuditLog)
  return Array.isArray(log) ? log : defaultAuditLog
}

function readOwnerSettings() {
  return {
    ...defaultOwnerSettings,
    ...readJson(ADMIN_OWNER_SETTINGS_KEY, {}),
  }
}

function hashName(value) {
  return value.split('').reduce((total, character) => {
    return total + character.charCodeAt(0)
  }, 0)
}

function getDensityColor(count) {
  return densityLegend.find((item) => count <= item.max).color
}

function getVolunteerDensity(districtName) {
  return 18 + (hashName(districtName) % 232)
}

function normalizeUser(user) {
  return {
    ...user,
    role: user.role === 'ngo' ? ROLES.NGO : user.role,
  }
}

function readAllUsers() {
  const storedUsers = readJson(USERS_KEY, null)
  return (Array.isArray(storedUsers) ? storedUsers : fallbackUsers)
    .filter((user) => user.role !== 'public')
    .map(normalizeUser)
}

function writeAllUsers(users) {
  writeJson(USERS_KEY, users.map(normalizeUser))
}

function createUserId() {
  if (crypto.randomUUID) {
    return `usr_${crypto.randomUUID()}`
  }

  return `usr_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function readUsers() {
  const users = readAllUsers()
    .filter((user) => user.role === ROLES.NGO)
  const operations = readJson(ADMIN_USER_OPS_KEY, {})

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    password: user.password || '',
    role: user.role,
    status: operations[user.id]?.status || 'Active',
    verified: operations[user.id]?.verified ?? false,
  }))
}

function persistNgoLogin(account) {
  const normalizedEmail = account.email.trim().toLowerCase()
  const nextUsers = readAllUsers().map((user) =>
    user.id === account.id
      ? {
          ...user,
          name: account.name.trim(),
          email: normalizedEmail,
          password: account.password,
          role: ROLES.NGO,
        }
      : user,
  )

  writeAllUsers(nextUsers)
}

function createNgoLogin(account) {
  const newAccount = {
    id: createUserId(),
    name: account.name.trim(),
    email: account.email.trim().toLowerCase(),
    password: account.password,
    role: ROLES.NGO,
  }

  writeAllUsers([newAccount, ...readAllUsers()])
  return newAccount
}

function deleteNgoLogin(userId) {
  writeAllUsers(readAllUsers().filter((user) => user.id !== userId))

  const operations = readJson(ADMIN_USER_OPS_KEY, {})
  delete operations[userId]
  writeJson(ADMIN_USER_OPS_KEY, operations)
}

function persistUserOperations(users) {
  const existingOperations = readJson(ADMIN_USER_OPS_KEY, {})
  const operations = users.reduce((summary, user) => {
    summary[user.id] = {
      status: user.status,
      verified: user.verified,
    }
    return summary
  }, { ...existingOperations })

  writeJson(ADMIN_USER_OPS_KEY, operations)
}

function formatNumber(value, locale = 'en-BD') {
  return new Intl.NumberFormat(locale).format(value)
}

function formatDateTime(value, locale = 'en-BD') {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function AdminDashboard() {
  const { i18n, t } = useTranslation()
  const locale = i18n.language === 'bn-BD' ? 'bn-BD' : 'en-BD'
  const mapNodeRef = useRef(null)
  const mapRef = useRef(null)
  const geoJsonLayerRef = useRef(null)
  const selectedLayerRef = useRef(null)
  const riskByDistrictRef = useRef({})
  const [users, setUsers] = useState(readUsers)
  const [districts, setDistricts] = useState([])
  const [riskByDistrict, setRiskByDistrict] = useState(() =>
    readJson(ADMIN_DISTRICT_RISKS_KEY, {}),
  )
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [riskLevel, setRiskLevel] = useState('Medium')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastStatus, setBroadcastStatus] = useState('idle')
  const [lastBroadcast, setLastBroadcast] = useState(null)
  const [smsSent, setSmsSent] = useState(() => Number(localStorage.getItem(ADMIN_SMS_SENT_KEY)) || 48392)
  const [selectedMapDistrict, setSelectedMapDistrict] = useState(null)
  const [mapStatus, setMapStatus] = useState(t('admin.mapLoading'))
  const [auditLog, setAuditLog] = useState(readAuditLog)
  const [ownerSettings, setOwnerSettings] = useState(readOwnerSettings)
  const [ownerSavedMessage, setOwnerSavedMessage] = useState('')
  const [ngoAccountMessage, setNgoAccountMessage] = useState('')
  const [newNgoAccount, setNewNgoAccount] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [dataSnapshot, setDataSnapshot] = useState(() => ({
    donationAccounts: getDonationAccounts(),
    helpRequests: getHelpRequests(),
    volunteerProfiles: getVolunteerProfiles(),
  }))
  const [systemHealth, setSystemHealth] = useState({
    api: 'Checking',
    database: 'Checking',
    ffwc: 'Checking',
    frontend: 'Online',
    lastChecked: new Date().toISOString(),
  })

  useEffect(() => {
    riskByDistrictRef.current = riskByDistrict
  }, [riskByDistrict])

  useEffect(() => {
    const controller = new AbortController()

    async function checkSystemHealth() {
      const [healthResult, ffwcResult] = await Promise.allSettled([
        fetch('/health', { signal: controller.signal }).then((response) => {
          if (!response.ok) throw new Error('API offline')
          return response.json()
        }),
        fetch('/api/ffwc/water-levels', { signal: controller.signal }).then(
          (response) => {
            if (!response.ok) throw new Error('FFWC offline')
            return response.json()
          },
        ),
      ])

      if (controller.signal.aborted) return

      const healthData =
        healthResult.status === 'fulfilled' ? healthResult.value : null

      setSystemHealth({
        api: healthData?.ok ? 'Online' : 'Offline',
        database: healthData?.db === 'ready' ? 'Ready' : 'Pending',
        ffwc:
          ffwcResult.status === 'fulfilled' &&
          ffwcResult.value?.waterLevels?.length
            ? 'Connected'
            : 'Error',
        frontend: 'Online',
        lastChecked: new Date().toISOString(),
      })
    }

    checkSystemHealth().catch(() => {
      if (!controller.signal.aborted) {
        setSystemHealth((current) => ({
          ...current,
          api: 'Offline',
          database: 'Pending',
          ffwc: 'Error',
          lastChecked: new Date().toISOString(),
        }))
      }
    })

    return () => controller.abort()
  }, [])

  const districtProfiles = useMemo(
    () =>
      districts.map((district) => ({
        ...district,
        density: getVolunteerDensity(district.name),
        riskLevel: riskByDistrict[district.name] || district.defaultRisk,
      })),
    [districts, riskByDistrict],
  )

  const stats = useMemo(
    () => ({
      volunteerCoverage: districtProfiles.reduce(
        (total, district) => total + district.density,
        0,
      ),
      ngoAccounts: users.length,
      pendingNgoApprovals: users.filter(
        (user) => !user.verified && user.status !== 'Banned',
      ).length,
      publicRequests: dataSnapshot.helpRequests.length,
      activeDonationChannels: dataSnapshot.donationAccounts.length,
      sheltersReportingToday: 31,
      totalSmsSent: smsSent,
    }),
    [dataSnapshot, districtProfiles, smsSent, users],
  )

  const requestSummary = useMemo(
    () => ({
      pending: dataSnapshot.helpRequests.filter(
        (request) => request.status === 'Pending',
      ).length,
      assigned: dataSnapshot.helpRequests.filter(
        (request) => request.status === 'Assigned',
      ).length,
      completed: dataSnapshot.helpRequests.filter(
        (request) => request.status === 'Completed',
      ).length,
    }),
    [dataSnapshot.helpRequests],
  )

  const riskSummary = useMemo(
    () =>
      Object.keys(riskLevels).map((level) => ({
        level,
        count: districtProfiles.filter((district) => district.riskLevel === level)
          .length,
      })),
    [districtProfiles],
  )

  const appendAuditEntry = useCallback((action, details) => {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      details,
      createdAt: new Date().toISOString(),
    }

    setAuditLog((current) => {
      const nextLog = [entry, ...current].slice(0, 12)
      writeJson(ADMIN_AUDIT_LOG_KEY, nextLog)
      return nextLog
    })
  }, [])

  const refreshOwnerData = useCallback(() => {
    setDataSnapshot({
      donationAccounts: getDonationAccounts(),
      helpRequests: getHelpRequests(),
      volunteerProfiles: getVolunteerProfiles(),
    })
    appendAuditEntry('Owner data refreshed', 'Latest local records loaded into the dashboard.')
  }, [appendAuditEntry])

  const getDistrictStyle = useCallback((feature) => {
    const name = getDistrictName(feature.properties)
    const risk = riskByDistrictRef.current[name]
    const density = getVolunteerDensity(name)

    return {
      color: riskLevels[risk]?.color || '#ffffff',
      fillColor: getDensityColor(density),
      fillOpacity: 0.72,
      opacity: 0.95,
      weight: risk ? 2 : 1,
    }
  }, [])

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) {
      return undefined
    }

    const map = createBangladeshMap(mapNodeRef.current)
    mapRef.current = map

    async function loadDistricts() {
      try {
        const response = await fetch('/data/bangladesh-districts.geojson')

        if (!response.ok) {
          throw new Error(t('map.loadError'))
        }

        const geoJson = await response.json()

        const lastUpdated = new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date())

        const nextDistricts = geoJson.features
          .map((feature) => {
            const name = getDistrictName(feature.properties)
            const risk = getDistrictFloodRisk(feature, lastUpdated)

            return {
              name,
              division: feature.properties.adm1_en || 'Bangladesh',
              defaultRisk: risk.riskLevel,
            }
          })
          .sort((first, second) => first.name.localeCompare(second.name))

        setDistricts(nextDistricts)
        setSelectedDistrict((current) => current || nextDistricts[0]?.name || '')

        const districtLayer = L.geoJSON(geoJson, {
          style: getDistrictStyle,
          onEachFeature: (feature, layer) => {
            const name = getDistrictName(feature.properties)

            layer.bindTooltip(name, {
              direction: 'center',
              opacity: 0.92,
              sticky: true,
            })

            layer.on({
              click: () => {
                if (selectedLayerRef.current) {
                  geoJsonLayerRef.current.resetStyle(selectedLayerRef.current)
                }

                selectedLayerRef.current = layer
                layer.setStyle({
                  color: '#111827',
                  fillOpacity: 0.92,
                  weight: 3,
                })
                setSelectedDistrict(name)
                setSelectedMapDistrict({
                  density: getVolunteerDensity(name),
                  name,
                })
              },
              mouseover: () => {
                if (selectedLayerRef.current !== layer) {
                  layer.setStyle({
                    color: '#111827',
                    fillOpacity: 0.86,
                    weight: 2,
                  })
                }
              },
              mouseout: () => {
                if (selectedLayerRef.current !== layer) {
                  geoJsonLayerRef.current.resetStyle(layer)
                }
              },
            })
          },
        }).addTo(map)

        geoJsonLayerRef.current = districtLayer
        map.fitBounds(districtLayer.getBounds(), { padding: [18, 18] })
        setMapStatus(t('admin.mapLoaded'))
      } catch (error) {
        setMapStatus(error.message)
      }
    }

    loadDistricts()

    return () => {
      map.remove()
      mapRef.current = null
      geoJsonLayerRef.current = null
      selectedLayerRef.current = null
    }
  }, [getDistrictStyle, locale, t])

  useEffect(() => {
    if (selectedDistrict) {
      const district = districts.find((item) => item.name === selectedDistrict)
      setRiskLevel(riskByDistrict[selectedDistrict] || district?.defaultRisk || 'Medium')
    }
  }, [districts, riskByDistrict, selectedDistrict])

  useEffect(() => {
    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.setStyle(getDistrictStyle)
    }
  }, [getDistrictStyle, riskByDistrict])

  const updateUsers = (updater) => {
    setUsers((current) => {
      const nextUsers = updater(current)
      persistUserOperations(nextUsers)
      return nextUsers
    })
  }

  const updateNgoAccount = (userId, field, value) => {
    setNgoAccountMessage('')
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, [field]: value } : user,
      ),
    )
  }

  const validateNgoAccount = (account) => {
    const email = account.email.trim().toLowerCase()

    if (!account.name.trim() || !email || !account.password) {
      return 'Name, email, and password are required.'
    }

    if (!email.includes('@')) {
      return 'Enter a valid NGO login email.'
    }

    const duplicate = readAllUsers().find(
      (user) => user.email === email && user.id !== account.id,
    )

    if (duplicate) {
      return 'Another account already uses this email.'
    }

    return ''
  }

  const saveNgoAccount = (account) => {
    const validationError = validateNgoAccount(account)

    if (validationError) {
      setNgoAccountMessage(validationError)
      return
    }

    const savedAccount = {
      ...account,
      name: account.name.trim(),
      email: account.email.trim().toLowerCase(),
      password: account.password,
    }

    persistNgoLogin(savedAccount)
    setUsers((current) =>
      current.map((user) =>
        user.id === account.id ? { ...user, ...savedAccount } : user,
      ),
    )
    setNgoAccountMessage(`${savedAccount.name} login updated.`)
    appendAuditEntry(
      'NGO login updated',
      `${savedAccount.name} email/password credentials were edited by owner.`,
    )
  }

  const addNgoAccount = (event) => {
    event.preventDefault()

    const validationError = validateNgoAccount(newNgoAccount)

    if (validationError) {
      setNgoAccountMessage(validationError)
      return
    }

    const createdAccount = createNgoLogin(newNgoAccount)
    const nextAccount = {
      ...createdAccount,
      status: 'Active',
      verified: false,
    }

    persistUserOperations([nextAccount])
    setUsers((current) => [nextAccount, ...current])
    setNewNgoAccount({
      name: '',
      email: '',
      password: '',
    })
    setNgoAccountMessage(`${nextAccount.name} NGO login added.`)
    appendAuditEntry(
      'NGO login created',
      `${nextAccount.name} can sign in after owner approval.`,
    )
  }

  const removeNgoAccount = (account) => {
    deleteNgoLogin(account.id)
    setUsers((current) => current.filter((user) => user.id !== account.id))
    setNgoAccountMessage(`${account.name} NGO login deleted.`)
    appendAuditEntry(
      'NGO login deleted',
      `${account.name} was removed from coordinator access.`,
    )
  }

  const verifyUser = (userId) => {
    const account = users.find((user) => user.id === userId)

    updateUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, verified: true } : user,
      ),
    )
    appendAuditEntry(
      'NGO approved',
      `${account?.name || 'NGO account'} can now access coordinator tools.`,
    )
  }

  const toggleBanUser = (userId) => {
    const account = users.find((user) => user.id === userId)
    const nextStatus = account?.status === 'Banned' ? 'Active' : 'Banned'

    updateUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? { ...user, status: nextStatus }
          : user,
      ),
    )
    appendAuditEntry(
      nextStatus === 'Banned' ? 'NGO suspended' : 'NGO restored',
      `${account?.name || 'NGO account'} status changed to ${nextStatus}.`,
    )
  }

  const saveRiskLevel = (event) => {
    event.preventDefault()

    const nextRisks = {
      ...riskByDistrict,
      [selectedDistrict]: riskLevel,
    }

    setRiskByDistrict(nextRisks)
    writeJson(ADMIN_DISTRICT_RISKS_KEY, nextRisks)
    appendAuditEntry(
      'District risk updated',
      `${selectedDistrict} is now marked ${riskLevel}.`,
    )
  }

  const pushBroadcast = async (event) => {
    event.preventDefault()

    const message = broadcastMessage.trim()
    const sentAt = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    setBroadcastStatus('sending')

    try {
      const response = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district: selectedDistrict,
          severity: riskLevel,
          title: `${riskLevel} flood alert - ${selectedDistrict}`,
          message: `[${riskLevel} flood alert - ${selectedDistrict}] ${message}`,
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok && response.status !== 404) {
        throw new Error(payload.error || 'Could not send SMS alert.')
      }

      const sent = payload.sent || 0
      const failed = payload.failed || 0
      const total = payload.total || 0
      const nextSmsSent = smsSent + sent

      setSmsSent(nextSmsSent)
      localStorage.setItem(ADMIN_SMS_SENT_KEY, String(nextSmsSent))
      setLastBroadcast({
        district: selectedDistrict,
        error: payload.warning || (response.status === 404 ? payload.error : ''),
        failed,
        message,
        recipients: sent,
        riskLevel,
        sentAt,
        total,
      })
      setBroadcastMessage('')
      setBroadcastStatus('idle')
      appendAuditEntry(
        sent > 0 ? 'SMS broadcast sent' : 'SMS broadcast had no recipients',
        sent > 0
          ? `${sent} SMS alert${sent === 1 ? '' : 's'} sent for ${selectedDistrict}.`
          : payload.error || `No subscribers found for ${selectedDistrict}.`,
      )
    } catch (error) {
      setLastBroadcast({
        district: selectedDistrict,
        error: error.message,
        failed: 0,
        message,
        recipients: 0,
        riskLevel,
        sentAt,
        total: 0,
      })
      setBroadcastStatus('idle')
      appendAuditEntry('SMS broadcast failed', error.message)
    }
  }

  const updateOwnerSetting = (field, value) => {
    setOwnerSavedMessage('')
    setOwnerSettings((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const saveOwnerSettings = (event) => {
    event.preventDefault()
    writeJson(ADMIN_OWNER_SETTINGS_KEY, ownerSettings)
    setOwnerSavedMessage('Owner settings saved.')
    appendAuditEntry(
      'Owner settings saved',
      `Donation status: ${ownerSettings.donationStatus}; SMS mode: ${ownerSettings.smsMode}.`,
    )
  }

  return (
    <section className="page-shell">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('admin.eyebrow')}
          </p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">
            {t('admin.title')}
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            {t('admin.intro')}
          </p>
        </div>
        <span className="self-start rounded-md bg-accent-50 px-3 py-2 text-sm font-bold text-accent-700 md:self-auto">
          {t('admin.adminOnly')}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Pending NGO approvals
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.pendingNgoApprovals, locale)}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Owner review only
          </p>
        </article>
        <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Public help requests
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.publicRequests, locale)}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {formatNumber(requestSummary.pending, locale)} pending triage
          </p>
        </article>
        <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Donation channels
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.activeDonationChannels, locale)}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Public donation methods
          </p>
        </article>
        <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('admin.totalSmsSent')}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.totalSmsSent, locale)}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Alert broadcast counter
          </p>
        </article>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-lg border border-primary-100 bg-white shadow-soft">
          <div className="bg-slate-950 p-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-200">
              Owner control center
            </p>
            <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <h2 className="text-2xl font-bold">Platform settings</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Control public donation status, emergency contact text, and
                  operational messaging mode from one place.
                </p>
              </div>
              <button
                className="rounded-md bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-accent-100"
                onClick={refreshOwnerData}
                type="button"
              >
                Refresh data
              </button>
            </div>
          </div>

          <form className="grid gap-5 p-5 lg:grid-cols-2" onSubmit={saveOwnerSettings}>
            <label className="form-label">
              Emergency hotline
              <input
                className="form-input"
                onChange={(event) =>
                  updateOwnerSetting('hotline', event.target.value)
                }
                value={ownerSettings.hotline}
              />
            </label>
            <label className="form-label">
              Donation status
              <select
                className="form-input"
                onChange={(event) =>
                  updateOwnerSetting('donationStatus', event.target.value)
                }
                value={ownerSettings.donationStatus}
              >
                {['Open', 'Paused', 'Emergency only'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              SMS mode
              <select
                className="form-input"
                onChange={(event) =>
                  updateOwnerSetting('smsMode', event.target.value)
                }
                value={ownerSettings.smsMode}
              >
                {['Dry run', 'Ready for provider', 'Live provider'].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label lg:row-span-2">
              Public notice
              <textarea
                className="form-input min-h-[132px] resize-y"
                onChange={(event) =>
                  updateOwnerSetting('publicNotice', event.target.value)
                }
                value={ownerSettings.publicNotice}
              />
            </label>
            <div className="flex flex-col justify-end gap-3">
              <button className="button-primary" type="submit">
                Save owner settings
              </button>
              {ownerSavedMessage ? (
                <p className="rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
                  {ownerSavedMessage}
                </p>
              ) : null}
            </div>
          </form>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              System health
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Live service checks
            </h2>
            <div className="mt-5 grid gap-3">
              {[
                ['Frontend', systemHealth.frontend],
                ['Backend API', systemHealth.api],
                ['Database', systemHealth.database],
                ['FFWC live data', systemHealth.ffwc],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3"
                  key={label}
                >
                  <span className="text-sm font-bold text-slate-700">
                    {label}
                  </span>
                  <span
                    className={[
                      'rounded-md px-2.5 py-1 text-xs font-bold',
                      healthStyles[value] || healthStyles.Checking,
                    ].join(' ')}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              Last checked {formatDateTime(systemHealth.lastChecked, locale)}
            </p>
          </section>

          <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Owner scope
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Approval responsibility
            </h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-700">
              <p className="rounded-md bg-primary-50 p-3 text-primary-900">
                Owner/admin approves NGO accounts.
              </p>
              <p className="rounded-md bg-slate-50 p-3">
                NGO coordinators approve and manage volunteer profiles.
              </p>
              <p className="rounded-md bg-slate-50 p-3">
                Current volunteer profiles:{' '}
                {formatNumber(dataSnapshot.volunteerProfiles.length, locale)}
              </p>
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="rounded-lg border border-primary-100 bg-white shadow-soft">
          <div className="border-b border-primary-100 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Owner approval
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              NGO coordinator accounts
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              As the site owner, review and approve NGO/coordinator access. Volunteer
              approval is handled by NGO coordinators. You can also create,
              update, or remove NGO login credentials here.
            </p>
          </div>

          <form
            className="grid gap-4 border-b border-primary-100 bg-slate-50 p-5 lg:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={addNgoAccount}
          >
            <label className="form-label">
              NGO name
              <input
                className="form-input bg-white"
                onChange={(event) =>
                  setNewNgoAccount((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Example NGO"
                value={newNgoAccount.name}
              />
            </label>
            <label className="form-label">
              Login email
              <input
                className="form-input bg-white"
                onChange={(event) =>
                  setNewNgoAccount((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="ngo@example.com"
                type="email"
                value={newNgoAccount.email}
              />
            </label>
            <label className="form-label">
              Password
              <input
                className="form-input bg-white"
                onChange={(event) =>
                  setNewNgoAccount((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Set temporary password"
                type="text"
                value={newNgoAccount.password}
              />
            </label>
            <div className="flex items-end">
              <button className="button-primary w-full" type="submit">
                Add NGO
              </button>
            </div>
          </form>

          {ngoAccountMessage ? (
            <p className="border-b border-primary-100 bg-primary-50 px-5 py-3 text-sm font-bold text-primary-900">
              {ngoAccountMessage}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('admin.user')}</th>
                  <th className="px-5 py-3">Login password</th>
                  <th className="px-5 py-3">{t('admin.role')}</th>
                  <th className="px-5 py-3">{t('admin.verification')}</th>
                  <th className="px-5 py-3">{t('admin.status')}</th>
                  <th className="px-5 py-3">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {users.map((account) => (
                    <tr key={account.id}>
                      <td className="px-5 py-4">
                        <div className="grid min-w-[240px] gap-2">
                          <input
                            className="form-input py-2"
                            onChange={(event) =>
                              updateNgoAccount(
                                account.id,
                                'name',
                                event.target.value,
                              )
                            }
                            value={account.name}
                          />
                          <input
                            className="form-input py-2"
                            onChange={(event) =>
                              updateNgoAccount(
                                account.id,
                                'email',
                                event.target.value,
                              )
                            }
                            type="email"
                            value={account.email}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className="form-input min-w-[180px] py-2"
                          onChange={(event) =>
                            updateNgoAccount(
                              account.id,
                              'password',
                              event.target.value,
                            )
                          }
                          type="text"
                          value={account.password}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-sky-100 px-3 py-2 text-xs font-bold text-sky-800">
                          {t(`roles.${account.role}`)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={[
                            'rounded-md px-2.5 py-1 text-xs font-bold',
                            account.verified
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800',
                          ].join(' ')}
                        >
                          {account.verified
                            ? t('admin.verified')
                            : t('admin.pending')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusStyles[account.status]}`}
                        >
                          {t(`admin.userStatus.${account.status}`)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="button-secondary px-3 py-2"
                            onClick={() => saveNgoAccount(account)}
                            type="button"
                          >
                            Save login
                          </button>
                          <button
                            className="button-secondary px-3 py-2"
                            disabled={account.verified}
                            onClick={() => verifyUser(account.id)}
                            type="button"
                          >
                            {t('admin.verify')}
                          </button>
                          <button
                            className="button-secondary px-3 py-2"
                            onClick={() => toggleBanUser(account.id)}
                            type="button"
                          >
                            {account.status === 'Banned'
                              ? t('admin.restore')
                              : t('admin.ban')}
                          </button>
                          <button
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
                            onClick={() => removeNgoAccount(account)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {users.length === 0 ? (
                  <tr>
                    <td
                      className="px-5 py-8 text-center font-semibold text-slate-500"
                      colSpan="6"
                    >
                      No NGO coordinator accounts are waiting for owner review.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('admin.districtAlerts')}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            {t('admin.riskBroadcast')}
          </h2>

          <form className="mt-5 grid gap-4" onSubmit={saveRiskLevel}>
            <label className="form-label">
              {t('shelters.district')}
              <select
                className="form-input"
                onChange={(event) => setSelectedDistrict(event.target.value)}
                value={selectedDistrict}
              >
                {districts.map((district) => (
                  <option key={district.name} value={district.name}>
                    {district.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              {t('admin.riskLevel')}
              <select
                className="form-input"
                onChange={(event) => setRiskLevel(event.target.value)}
                value={riskLevel}
              >
                {Object.keys(riskLevels).map((level) => (
                  <option key={level} value={level}>
                    {t(`risk.${level}`)}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-primary" type="submit">
              {t('admin.saveRisk')}
            </button>
          </form>

          <form className="mt-6 grid gap-4 border-t border-primary-100 pt-5" onSubmit={pushBroadcast}>
            <label className="form-label">
              {t('admin.broadcastAlert')}
              <textarea
                className="form-input min-h-[120px] resize-y"
                onChange={(event) => setBroadcastMessage(event.target.value)}
                placeholder={t('admin.broadcastPlaceholder')}
                required
                value={broadcastMessage}
              />
            </label>
            <button
              className="button-primary"
              disabled={broadcastStatus === 'sending'}
              type="submit"
            >
              {broadcastStatus === 'sending' ? 'Sending SMS...' : t('admin.pushBroadcast')}
            </button>
          </form>

          {lastBroadcast ? (
            <div
              className={[
                'mt-5 rounded-md p-4 text-sm',
                lastBroadcast.error
                  ? 'border border-amber-200 bg-amber-50 text-amber-900'
                  : 'bg-primary-50 text-primary-900',
              ].join(' ')}
            >
              <p className="font-bold">
                {t('admin.sentTo', {
                  district: lastBroadcast.district,
                  sentAt: lastBroadcast.sentAt,
                })}
              </p>
              <p className="mt-1">
                {lastBroadcast.error
                  ? lastBroadcast.error
                  : t('admin.recipientsRisk', {
                      recipients: formatNumber(lastBroadcast.recipients, locale),
                      risk: t(`risk.${lastBroadcast.riskLevel}`),
                    })}
              </p>
              {lastBroadcast.total ? (
                <p className="mt-1 font-semibold">
                  Sent {formatNumber(lastBroadcast.recipients, locale)} of{' '}
                  {formatNumber(lastBroadcast.total, locale)}
                  {lastBroadcast.failed
                    ? `, ${formatNumber(lastBroadcast.failed, locale)} failed`
                    : ''}
                  .
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            {riskSummary.map((item) => (
              <div
                className={`${riskLevels[item.level].bgClass} rounded-md p-3 ${riskLevels[item.level].textClass}`}
                key={item.level}
              >
                <p className="text-xs font-bold uppercase tracking-wide">
                  {t(`risk.${item.level}`)}
                </p>
                <p className="mt-1 text-2xl font-bold">{item.count}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Relief data snapshot
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Requests and donation oversight
              </h2>
            </div>
            <span className="self-start rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 md:self-auto">
              Local records
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Pending', requestSummary.pending],
              ['Assigned', requestSummary.assigned],
              ['Completed', requestSummary.completed],
            ].map(([label, value]) => (
              <div className="rounded-md bg-primary-50 p-4" key={label}>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {formatNumber(value, locale)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            {dataSnapshot.donationAccounts.slice(0, 4).map((account) => (
              <div
                className="flex flex-col justify-between gap-2 rounded-md border border-primary-100 bg-slate-50 p-4 sm:flex-row sm:items-center"
                key={account.id}
              >
                <div>
                  <p className="font-bold text-slate-950">{account.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {account.accountName}
                  </p>
                </div>
                <span className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-700">
                  {account.accountNumber}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Owner audit
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Recent admin actions
              </h2>
            </div>
            <span className="self-start rounded-md bg-accent-50 px-3 py-2 text-sm font-bold text-accent-700 md:self-auto">
              {auditLog.length} events
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {auditLog.map((entry) => (
              <article
                className="rounded-md border border-primary-100 bg-slate-50 p-4"
                key={entry.id}
              >
                <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
                  <div>
                    <p className="font-bold text-slate-950">{entry.action}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {entry.details}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white px-3 py-2 text-xs font-bold text-slate-500">
                    {formatDateTime(entry.createdAt, locale)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t('admin.densityMap')}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {t('admin.coverageOverlay')}
            </h2>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
            {t('map.districts', { count: districts.length || 64 })}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative h-[min(68vh,620px)] overflow-hidden rounded-lg border border-primary-100">
            <div ref={mapNodeRef} className="h-full" />
            <div className="absolute bottom-4 left-4 z-[400] rounded-md border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur">
              <p className="mb-2 font-semibold text-slate-900">
                {t('admin.volunteersPerDistrict')}
              </p>
              <div className="grid gap-2">
                {densityLegend.map((item) => (
                  <div className="flex items-center gap-2" key={item.label}>
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-primary-100 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {t('admin.selectedDistrict')}
            </p>
            {selectedMapDistrict ? (
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-950">
                  {selectedMapDistrict.name}
                </h3>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {t('admin.activeVolunteerCount', {
                    count: formatNumber(selectedMapDistrict.density, locale),
                  })}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t('admin.currentRiskOverride')}{' '}
                  <span className="font-bold text-slate-950">
                    {riskByDistrict[selectedMapDistrict.name]
                      ? t(`risk.${riskByDistrict[selectedMapDistrict.name]}`)
                      : t('admin.defaultRisk')}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-slate-600">
                {mapStatus}. {t('admin.mapHint')}
              </p>
            )}
          </aside>
        </div>
      </section>
    </section>
  )
}

export default AdminDashboard
