import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { ROLE_OPTIONS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { getDistrictFloodRisk, getDistrictName, riskLevels } from '../utils/floodRisk.js'
import { createBangladeshMap } from '../utils/map.js'

const USERS_KEY = 'mock_auth_users'
const ADMIN_USER_OPS_KEY = 'admin_user_ops'
const ADMIN_DISTRICT_RISKS_KEY = 'admin_district_risks'
const ADMIN_SMS_SENT_KEY = 'admin_sms_sent'

const fallbackUsers = [
  {
    id: 'usr_public',
    name: 'Public User',
    email: 'public@example.com',
    role: ROLES.PUBLIC,
  },
  {
    id: 'usr_volunteer',
    name: 'Volunteer User',
    email: 'volunteer@example.com',
    role: ROLES.VOLUNTEER,
  },
  {
    id: 'usr_coordinator',
    name: 'NGO Coordinator',
    email: 'coordinator@example.com',
    role: ROLES.NGO,
  },
  {
    id: 'usr_admin',
    name: 'Admin User',
    email: 'admin@example.com',
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

function readUsers() {
  const storedUsers = readJson(USERS_KEY, null)
  const users = Array.isArray(storedUsers) ? storedUsers : fallbackUsers
  const operations = readJson(ADMIN_USER_OPS_KEY, {})

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: operations[user.id]?.status || 'Active',
    verified: operations[user.id]?.verified ?? user.role !== ROLES.PUBLIC,
  }))
}

function persistUserOperations(users) {
  const operations = users.reduce((summary, user) => {
    summary[user.id] = {
      status: user.status,
      verified: user.verified,
    }
    return summary
  }, {})

  writeJson(ADMIN_USER_OPS_KEY, operations)
}

function persistUserRoles(users) {
  const storedUsers = readJson(USERS_KEY, null)

  if (!Array.isArray(storedUsers)) {
    return
  }

  writeJson(
    USERS_KEY,
    storedUsers.map((storedUser) => {
      const updatedUser = users.find((user) => user.id === storedUser.id)
      return updatedUser ? { ...storedUser, role: updatedUser.role } : storedUser
    }),
  )
}

function formatNumber(value, locale = 'en-BD') {
  return new Intl.NumberFormat(locale).format(value)
}

function AdminDashboard() {
  const { i18n, t } = useTranslation()
  const { user: currentUser } = useAuth()
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
  const [lastBroadcast, setLastBroadcast] = useState(null)
  const [smsSent, setSmsSent] = useState(() => Number(localStorage.getItem(ADMIN_SMS_SENT_KEY)) || 48392)
  const [selectedMapDistrict, setSelectedMapDistrict] = useState(null)
  const [mapStatus, setMapStatus] = useState(t('admin.mapLoading'))

  useEffect(() => {
    riskByDistrictRef.current = riskByDistrict
  }, [riskByDistrict])

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
      activeVolunteers: districtProfiles.reduce(
        (total, district) => total + district.density,
        0,
      ),
      sheltersReportingToday: 31,
      totalSmsSent: smsSent,
    }),
    [districtProfiles, smsSent],
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
      persistUserRoles(nextUsers)
      return nextUsers
    })
  }

  const verifyUser = (userId) => {
    updateUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, verified: true } : user,
      ),
    )
  }

  const toggleBanUser = (userId) => {
    updateUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? { ...user, status: user.status === 'Banned' ? 'Active' : 'Banned' }
          : user,
      ),
    )
  }

  const changeRole = (userId, role) => {
    updateUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, role } : user)),
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
  }

  const pushBroadcast = (event) => {
    event.preventDefault()

    const recipientEstimate =
      districtProfiles.find((district) => district.name === selectedDistrict)
        ?.density || 75
    const nextSmsSent = smsSent + recipientEstimate

    setSmsSent(nextSmsSent)
    localStorage.setItem(ADMIN_SMS_SENT_KEY, String(nextSmsSent))
    setLastBroadcast({
      district: selectedDistrict,
      message: broadcastMessage.trim(),
      recipients: recipientEstimate,
      riskLevel,
      sentAt: new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
    })
    setBroadcastMessage('')
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

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('admin.totalSmsSent')}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.totalSmsSent, locale)}
          </p>
        </article>
        <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('admin.activeVolunteers')}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.activeVolunteers, locale)}
          </p>
        </article>
        <article className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('admin.sheltersReporting')}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {stats.sheltersReportingToday}
          </p>
        </article>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="rounded-lg border border-primary-100 bg-white shadow-soft">
          <div className="border-b border-primary-100 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t('admin.userManagement')}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {t('admin.accountsPermissions')}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('admin.user')}</th>
                  <th className="px-5 py-3">{t('admin.role')}</th>
                  <th className="px-5 py-3">{t('admin.verification')}</th>
                  <th className="px-5 py-3">{t('admin.status')}</th>
                  <th className="px-5 py-3">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {users.map((account) => {
                  const isCurrentUser = account.id === currentUser.id

                  return (
                    <tr key={account.id}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950">{account.name}</p>
                        <p className="mt-1 text-slate-500">{account.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          className="form-input py-2"
                          disabled={isCurrentUser}
                          onChange={(event) =>
                            changeRole(account.id, event.target.value)
                          }
                          value={account.role}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {t(`roles.${role.value}`)}
                            </option>
                          ))}
                        </select>
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
                            disabled={account.verified}
                            onClick={() => verifyUser(account.id)}
                            type="button"
                          >
                            {t('admin.verify')}
                          </button>
                          <button
                            className="button-secondary px-3 py-2"
                            disabled={isCurrentUser}
                            onClick={() => toggleBanUser(account.id)}
                            type="button"
                          >
                            {account.status === 'Banned'
                              ? t('admin.restore')
                              : t('admin.ban')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
            <button className="button-primary" type="submit">
              {t('admin.pushBroadcast')}
            </button>
          </form>

          {lastBroadcast ? (
            <div className="mt-5 rounded-md bg-primary-50 p-4 text-sm text-primary-900">
              <p className="font-bold">
                {t('admin.sentTo', {
                  district: lastBroadcast.district,
                  sentAt: lastBroadcast.sentAt,
                })}
              </p>
              <p className="mt-1">
                {t('admin.recipientsRisk', {
                  recipients: formatNumber(lastBroadcast.recipients, locale),
                  risk: t(`risk.${lastBroadcast.riskLevel}`),
                })}
              </p>
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
