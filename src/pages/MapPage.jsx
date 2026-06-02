import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getDistrictFloodRisk,
  getDistrictName,
  riskLevels,
} from '../utils/floodRisk.js'
import { getHelpRequests, getVolunteerProfiles } from '../data/reliefData.js'
import useSocket from '../hooks/useSocket.js'
import { initialShelters } from '../data/shelters.js'
import { getLiveWaterLevels } from '../services/ffwc.js'
import { createBangladeshMap } from '../utils/map.js'
import { cacheDistrictRiskSnapshot } from '../utils/offlineRiskSnapshot.js'
import BrandHeader from '../components/BrandHeader.jsx'
import SiteFooter from '../components/SiteFooter.jsx'

const layerControls = [
  { key: 'risk', label: 'Flood risk' },
  { key: 'stations', label: 'FFWC stations' },
  { key: 'requests', label: 'Help requests' },
  { key: 'shelters', label: 'Safe shelters' },
  { key: 'ngos', label: 'NGO teams' },
  { key: 'volunteers', label: 'Volunteers' },
]

const requestStatusStyles = {
  Pending: '#F59E0B',
  Assigned: '#2563EB',
  Completed: '#16A34A',
}

const shelterStatusColors = {
  Open: '#059669',
  Full: '#F59E0B',
  Closed: '#64748B',
}

const markerColors = {
  ngo: '#7C3AED',
  volunteer: '#2563EB',
}

const defaultNgoLocations = [
  {
    id: 'ngo-sylhet',
    name: 'Sylhet NGO Coordination Desk',
    district: 'Sylhet',
    contact: '+8801711-001001',
    latitude: 24.9017,
    longitude: 91.8756,
  },
  {
    id: 'ngo-gaibandha',
    name: 'Gaibandha Field Coordination Desk',
    district: 'Gaibandha',
    contact: '+8801611-001004',
    latitude: 25.3341,
    longitude: 89.5486,
  },
  {
    id: 'ngo-jamalpur',
    name: 'Jamalpur Relief Coordination Desk',
    district: 'Jamalpur',
    contact: '+8801811-001002',
    latitude: 24.9433,
    longitude: 90.0062,
  },
]

const defaultVolunteerLocations = [
  {
    id: 'volunteer-sylhet',
    name: 'Boat rescue team',
    district: 'Sylhet',
    availability: 'Available',
    latitude: 24.8892,
    longitude: 91.8618,
  },
  {
    id: 'volunteer-sunamganj',
    name: 'Medical triage volunteers',
    district: 'Sunamganj',
    availability: 'Available',
    latitude: 24.9368,
    longitude: 91.3867,
  },
  {
    id: 'volunteer-kurigram',
    name: 'Dry food delivery team',
    district: 'Kurigram',
    availability: 'Busy',
    latitude: 25.8108,
    longitude: 89.6419,
  },
]

function getStationColor(risk) {
  return riskLevels[risk]?.color || '#2563EB'
}

function getRequestColor(status) {
  return requestStatusStyles[status] || '#7C3AED'
}

function createLetterIcon(label, color) {
  return L.divIcon({
    className: 'map-letter-icon',
    html: `<span class="map-letter-icon__badge" style="background:${color}">${label}</span>`,
    iconAnchor: [15, 15],
    iconSize: [30, 30],
    popupAnchor: [0, -15],
  })
}

function createShelterIcon(status) {
  const color = shelterStatusColors[status] || shelterStatusColors.Open

  return L.divIcon({
    className: 'shelter-map-icon',
    html: `
      <span class="shelter-map-icon__badge" style="background:${color}">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3 10.8 12 3l9 7.8" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      </span>
    `,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
    popupAnchor: [0, -18],
  })
}

function getShelterStatus(shelter) {
  if (shelter.status) return shelter.status
  if (shelter.isActive === false) return 'Closed'

  const occupancy = shelter.occupied ?? shelter.occupancy ?? 0
  const capacity = shelter.capacity ?? 0
  return capacity > 0 && occupancy >= capacity ? 'Full' : 'Open'
}

function normalizeShelter(shelter) {
  const districtName = shelter.district?.name || shelter.district || 'Bangladesh'
  const occupancy = Number(shelter.occupied ?? shelter.occupancy ?? 0)
  const capacity = Number(shelter.capacity ?? 0)

  return {
    id: shelter.id,
    name: shelter.name,
    address: shelter.address || [shelter.upazila, districtName].filter(Boolean).join(', '),
    district: districtName,
    latitude: Number(shelter.latitude),
    longitude: Number(shelter.longitude),
    occupied: Number.isFinite(occupancy) ? occupancy : 0,
    capacity: Number.isFinite(capacity) ? capacity : 0,
    resources: shelter.resources || [],
    contact: shelter.contact || '',
    status: getShelterStatus(shelter),
  }
}

function createProfileVolunteerLocations(profiles, districtCenters) {
  return profiles
    .map((profile, index) => {
      const location = profile.location || profile.district || ''
      const districtName = Object.keys(districtCenters).find((name) =>
        location.toLowerCase().includes(name),
      )
      const center = districtName ? districtCenters[districtName] : null

      if (!center) return null

      return {
        id: `profile-volunteer-${profile.userId || index}`,
        name: profile.name || 'Registered volunteer',
        district: districtName.replace(/\b\w/g, (character) =>
          character.toUpperCase(),
        ),
        availability: profile.availability || 'Available',
        latitude: center.lat + 0.018 + index * 0.004,
        longitude: center.lng - 0.018 - index * 0.004,
      }
    })
    .filter(Boolean)
}

function MapPage() {
  const { i18n, t } = useTranslation()
  const mapNodeRef = useRef(null)
  const mapRef = useRef(null)
  const geoJsonLayerRef = useRef(null)
  const ffwcLayerRef = useRef(null)
  const requestLayerRef = useRef(null)
  const shelterLayerRef = useRef(null)
  const ngoLayerRef = useRef(null)
  const volunteerLayerRef = useRef(null)
  const selectedLayerRef = useRef(null)
  const districtLayersByNameRef = useRef({})
  const districtCentersRef = useRef({})
  const visibleLayersRef = useRef({})
  const waterLevelUpdatesRef = useRef({})
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [selectedStation, setSelectedStation] = useState(null)
  const [districtCount, setDistrictCount] = useState(0)
  const [districtOptions, setDistrictOptions] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [mapStatus, setMapStatus] = useState(t('map.loading'))
  const [latestWaterUpdate, setLatestWaterUpdate] = useState(null)
  const [liveWaterStations, setLiveWaterStations] = useState([])
  const [waterStationStatus, setWaterStationStatus] = useState('Loading stations')
  const [helpRequests, setHelpRequests] = useState(() => getHelpRequests())
  const [shelters, setShelters] = useState(() => initialShelters.map(normalizeShelter))
  const [shelterStatus, setShelterStatus] = useState('Loading shelters')
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [selectedResponseLocation, setSelectedResponseLocation] = useState(null)
  const [visibleLayers, setVisibleLayers] = useState({
    ngos: true,
    requests: true,
    risk: true,
    shelters: true,
    stations: true,
    volunteers: true,
  })

  useEffect(() => {
    visibleLayersRef.current = visibleLayers
  }, [visibleLayers])
  const locale = i18n.language === 'bn-BD' ? 'bn-BD' : 'en-BD'
  const lastUpdated = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date()),
    [locale],
  )
  const lastUpdatedRef = useRef(lastUpdated)

  useEffect(() => {
    lastUpdatedRef.current = lastUpdated
  }, [lastUpdated])

  const getFeatureRisk = useCallback((feature) => {
    const risk = getDistrictFloodRisk(feature, lastUpdatedRef.current)
    const update = waterLevelUpdatesRef.current[risk.districtName.toLowerCase()]

    if (!update) {
      return risk
    }

    const riskLevel = riskLevels[update.riskLevel] ? update.riskLevel : risk.riskLevel

    return {
      ...risk,
      color: riskLevels[riskLevel].color,
      lastUpdated: update.lastUpdated || risk.lastUpdated,
      riskLevel,
      riverWaterLevel: update.riverWaterLevel || risk.riverWaterLevel,
    }
  }, [])

  const getDistrictStyle = useCallback((feature) => {
    const risk = getFeatureRisk(feature)
    const showRisk = visibleLayersRef.current.risk

    return {
      color: '#ffffff',
      fillColor: showRisk ? risk.color : '#CBD5E1',
      fillOpacity: showRisk ? 0.72 : 0.18,
      opacity: 0.95,
      weight: 1,
    }
  }, [getFeatureRisk])

  const socketHandlers = useMemo(
    () => ({
      water_level_update: (update) => {
        const districtName = update.district || update.districtName

        if (!districtName) {
          return
        }

        const nextUpdate = {
          districtName,
          lastUpdated:
            update.lastUpdated ||
            new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date()),
          riskLevel: update.riskLevel,
          riverWaterLevel: update.riverWaterLevel,
        }
        waterLevelUpdatesRef.current = {
          ...waterLevelUpdatesRef.current,
          [districtName.toLowerCase()]: nextUpdate,
        }
        setLatestWaterUpdate(nextUpdate)

        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.eachLayer((layer) => {
            const layerDistrictName = getDistrictName(layer.feature.properties)

            if (layerDistrictName.toLowerCase() === districtName.toLowerCase()) {
              const riskLevel = riskLevels[nextUpdate.riskLevel]
                ? nextUpdate.riskLevel
                : getFeatureRisk(layer.feature).riskLevel

              layer.setStyle({
                fillColor: riskLevels[riskLevel].color,
                fillOpacity: selectedLayerRef.current === layer ? 0.9 : 0.72,
              })
            }
          })
        }

        setSelectedDistrict((current) => {
          if (
            !current ||
            current.districtName.toLowerCase() !== districtName.toLowerCase()
          ) {
            return current
          }

          const riskLevel = riskLevels[nextUpdate.riskLevel]
            ? nextUpdate.riskLevel
            : current.riskLevel

          return {
            ...current,
            color: riskLevels[riskLevel].color,
            lastUpdated: nextUpdate.lastUpdated,
            riskLevel,
            riverWaterLevel:
              nextUpdate.riverWaterLevel || current.riverWaterLevel,
          }
        })
      },
    }),
    [getFeatureRisk, locale],
  )
  const { isConnected } = useSocket(socketHandlers)

  const selectDistrictLayer = useCallback((layer) => {
    if (!layer || !mapRef.current) {
      return
    }

    const currentRisk = getFeatureRisk(layer.feature)

    if (selectedLayerRef.current) {
      geoJsonLayerRef.current.resetStyle(selectedLayerRef.current)
    }

    selectedLayerRef.current = layer
    const showRisk = visibleLayersRef.current.risk
    layer.setStyle({
      color: '#111827',
      fillColor: showRisk ? currentRisk.color : '#CBD5E1',
      fillOpacity: showRisk ? 0.9 : 0.34,
      weight: 3,
    })
    setSelectedDistrict(currentRisk)
    setSelectedStation(null)
    setSelectedShelter(null)
    setSelectedResponseLocation(null)
    setLatestWaterUpdate(
      waterLevelUpdatesRef.current[currentRisk.districtName.toLowerCase()] ||
        null,
    )
    mapRef.current.fitBounds(layer.getBounds(), {
      maxZoom: 10,
      padding: [28, 28],
    })
  }, [getFeatureRisk])

  const searchDistrict = (event) => {
    event.preventDefault()
    const query = searchQuery.trim().toLowerCase()

    if (!query) return

    const districtName =
      districtOptions.find((name) => name.toLowerCase() === query) ||
      districtOptions.find((name) => name.toLowerCase().includes(query))
    const layer = districtName
      ? districtLayersByNameRef.current[districtName.toLowerCase()]
      : null

    if (layer) {
      selectDistrictLayer(layer)
      setSearchQuery(districtName)
    }
  }

  const toggleLayer = (layerKey) => {
    setVisibleLayers((current) => ({
      ...current,
      [layerKey]: !current[layerKey],
    }))
  }

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
        setDistrictCount(geoJson.features.length)
        setDistrictOptions(
          geoJson.features
            .map((feature) => getDistrictName(feature.properties))
            .sort((first, second) => first.localeCompare(second)),
        )
        const riskSnapshot = geoJson.features.map((feature) =>
          getFeatureRisk(feature),
        )
        cacheDistrictRiskSnapshot(riskSnapshot).catch(() => {})

        const districtLayer = L.geoJSON(geoJson, {
          style: getDistrictStyle,
          onEachFeature: (feature, layer) => {
            const risk = getFeatureRisk(feature)
            districtLayersByNameRef.current[risk.districtName.toLowerCase()] = layer

            layer.bindTooltip(risk.districtName, {
              direction: 'center',
              opacity: 0.92,
              sticky: true,
            })

            layer.on({
              click: () => {
                selectDistrictLayer(layer)
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
        districtLayer.eachLayer((layer) => {
          const name = getDistrictName(layer.feature.properties).toLowerCase()
          districtCentersRef.current[name] = layer.getBounds().getCenter()
        })
        setHelpRequests(getHelpRequests())
        map.fitBounds(districtLayer.getBounds(), { padding: [18, 18] })

        const firstFeature = geoJson.features[0]
        setSelectedDistrict(getFeatureRisk(firstFeature))
        setMapStatus(t('map.loaded'))
      } catch (error) {
        setMapStatus(error.message)
      }
    }

    loadDistricts()

    return () => {
      map.remove()
      mapRef.current = null
      geoJsonLayerRef.current = null
      ffwcLayerRef.current = null
      requestLayerRef.current = null
      shelterLayerRef.current = null
      ngoLayerRef.current = null
      volunteerLayerRef.current = null
      selectedLayerRef.current = null
      districtLayersByNameRef.current = {}
      districtCentersRef.current = {}
    }
  }, [getDistrictStyle, getFeatureRisk, selectDistrictLayer, t])

  useEffect(() => {
    if (!geoJsonLayerRef.current) return

    geoJsonLayerRef.current.setStyle(getDistrictStyle)

    if (selectedLayerRef.current) {
      const risk = getFeatureRisk(selectedLayerRef.current.feature)
      selectedLayerRef.current.setStyle({
        color: '#111827',
        fillColor: visibleLayers.risk ? risk.color : '#CBD5E1',
        fillOpacity: visibleLayers.risk ? 0.9 : 0.34,
        weight: 3,
      })
    }
  }, [getDistrictStyle, getFeatureRisk, visibleLayers.risk])

  useEffect(() => {
    const controller = new AbortController()

    async function loadWaterStations() {
      try {
        const data = await getLiveWaterLevels({ signal: controller.signal })
        const stations = (data.waterLevels || []).filter(
          (station) =>
            Number.isFinite(station.latitude) &&
            Number.isFinite(station.longitude) &&
            station.latitude >= 20 &&
            station.latitude <= 27 &&
            station.longitude >= 88 &&
            station.longitude <= 93,
        )

        setLiveWaterStations(stations)
        setWaterStationStatus(
          stations.length
            ? `${stations.length} live FFWC stations`
            : 'No live FFWC station coordinates',
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          setWaterStationStatus(error.message)
        }
      }
    }

    loadWaterStations()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadShelters() {
      try {
        const response = await fetch('/api/shelters?active=true', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Backend shelters unavailable')
        }

        const data = await response.json()
        const nextShelters = (data.shelters || [])
          .map(normalizeShelter)
          .filter(
            (shelter) =>
              Number.isFinite(shelter.latitude) &&
              Number.isFinite(shelter.longitude),
          )

        if (nextShelters.length) {
          setShelters(nextShelters)
          setShelterStatus(`${nextShelters.length} mapped shelters`)
          return
        }

        throw new Error('No mapped backend shelters')
      } catch (error) {
        if (controller.signal.aborted) return

        const fallbackShelters = initialShelters.map(normalizeShelter)
        setShelters(fallbackShelters)
        setShelterStatus(`${fallbackShelters.length} demo shelters`)
      }
    }

    loadShelters()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    if (ffwcLayerRef.current) {
      ffwcLayerRef.current.remove()
      ffwcLayerRef.current = null
    }

    if (!visibleLayers.stations) return

    const markers = liveWaterStations.map((station) => {
        const marker = L.circleMarker([station.latitude, station.longitude], {
        color: '#ffffff',
        fillColor: getStationColor(station.risk),
        fillOpacity: 0.92,
        radius: station.risk === 'Critical' ? 8 : 6,
        weight: 2,
      })

      marker.bindPopup(`
        <strong>${station.station}</strong><br/>
        ${station.river} | ${station.district}<br/>
        Level: ${station.level}<br/>
        Danger: ${station.dangerLevel}<br/>
        Trend: ${station.trend}
      `)
      marker.on('click', () => {
        setSelectedStation(station)
      })

      return marker
    })

    ffwcLayerRef.current = L.layerGroup(markers).addTo(mapRef.current)
  }, [liveWaterStations, visibleLayers.stations])

  useEffect(() => {
    if (!mapRef.current) return

    if (requestLayerRef.current) {
      requestLayerRef.current.remove()
      requestLayerRef.current = null
    }

    if (!visibleLayers.requests) return

    const requestsByDistrict = helpRequests.reduce((summary, request) => {
      if (!request.district) return summary

      const key = request.district.toLowerCase()
      summary[key] = [...(summary[key] || []), request]
      return summary
    }, {})

    const markers = Object.entries(requestsByDistrict)
      .map(([districtName, requests]) => {
        const center = districtCentersRef.current[districtName]

        if (!center) return null

        const pendingCount = requests.filter(
          (request) => request.status !== 'Completed',
        ).length
        const status = pendingCount ? 'Pending' : 'Completed'
        const marker = L.marker(center, {
          icon: createLetterIcon('H', getRequestColor(status)),
        })

        marker.bindPopup(`
          <strong>${requests[0].district}</strong><br/>
          ${requests.length} public help request${requests.length > 1 ? 's' : ''}<br/>
          ${pendingCount} open or assigned
        `)

        return marker
      })
      .filter(Boolean)

    requestLayerRef.current = L.layerGroup(markers).addTo(mapRef.current)
  }, [helpRequests, visibleLayers.requests])

  useEffect(() => {
    if (!mapRef.current) return

    if (ngoLayerRef.current) {
      ngoLayerRef.current.remove()
      ngoLayerRef.current = null
    }

    if (!visibleLayers.ngos) return

    const markers = defaultNgoLocations.map((ngo) => {
      const marker = L.marker([ngo.latitude, ngo.longitude], {
        icon: createLetterIcon('N', markerColors.ngo),
      })

      marker.bindPopup(`
        <strong>${ngo.name}</strong><br/>
        ${ngo.district}<br/>
        Contact: ${ngo.contact}
      `)
      marker.on('click', () => {
        setSelectedResponseLocation({
          ...ngo,
          label: 'Selected NGO team',
          type: 'NGO',
        })
        setSelectedShelter(null)
        setSelectedStation(null)
      })

      return marker
    })

    ngoLayerRef.current = L.layerGroup(markers).addTo(mapRef.current)
  }, [visibleLayers.ngos])

  useEffect(() => {
    if (!mapRef.current) return

    if (volunteerLayerRef.current) {
      volunteerLayerRef.current.remove()
      volunteerLayerRef.current = null
    }

    if (!visibleLayers.volunteers) return

    const profileLocations = createProfileVolunteerLocations(
      getVolunteerProfiles(),
      districtCentersRef.current,
    )
    const volunteerLocations = [...defaultVolunteerLocations, ...profileLocations]

    const markers = volunteerLocations.map((volunteer) => {
      const marker = L.marker([volunteer.latitude, volunteer.longitude], {
        icon: createLetterIcon('V', markerColors.volunteer),
      })

      marker.bindPopup(`
        <strong>${volunteer.name}</strong><br/>
        ${volunteer.district}<br/>
        Status: ${volunteer.availability}
      `)
      marker.on('click', () => {
        setSelectedResponseLocation({
          ...volunteer,
          label: 'Selected volunteer location',
          type: 'Volunteer',
        })
        setSelectedShelter(null)
        setSelectedStation(null)
      })

      return marker
    })

    volunteerLayerRef.current = L.layerGroup(markers).addTo(mapRef.current)
  }, [districtCount, visibleLayers.volunteers])

  useEffect(() => {
    if (!mapRef.current) return

    if (shelterLayerRef.current) {
      shelterLayerRef.current.remove()
      shelterLayerRef.current = null
    }

    if (!visibleLayers.shelters) return

    const markers = shelters
      .filter(
        (shelter) =>
          Number.isFinite(shelter.latitude) &&
          Number.isFinite(shelter.longitude),
      )
      .map((shelter) => {
        const availableBeds = Math.max(shelter.capacity - shelter.occupied, 0)
        const marker = L.marker([shelter.latitude, shelter.longitude], {
          icon: createShelterIcon(shelter.status),
        })

        marker.bindPopup(`
          <strong>${shelter.name}</strong><br/>
          ${shelter.address || shelter.district}<br/>
          Status: ${shelter.status}<br/>
          Capacity: ${shelter.occupied}/${shelter.capacity}<br/>
          Available: ${availableBeds}
        `)
        marker.on('click', () => {
          setSelectedShelter(shelter)
          setSelectedStation(null)
        })

        return marker
      })

    shelterLayerRef.current = L.layerGroup(markers).addTo(mapRef.current)
  }, [shelters, visibleLayers.shelters])

  return (
    <>
      <BrandHeader>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/">
          Home
        </Link>
        <Link className="rounded-md bg-white px-3 py-2 text-sky-800" to="/map">
          Map
        </Link>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/alerts">
          SMS alerts
        </Link>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/request-help">
          Request help
        </Link>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/donate">
          Donate
        </Link>
        <Link className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10" to="/shelters">
          Shelters
        </Link>
      </BrandHeader>

      <main>
        <section className="page-shell">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('map.eyebrow')}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            {t('map.title')}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-primary-100 px-3 py-2 text-sm font-semibold text-primary-800">
            {t('map.districts', { count: districtCount || 64 })}
          </span>
          <span
            className={[
              'rounded-md px-3 py-2 text-sm font-semibold',
              isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-slate-200 text-slate-700',
            ].join(' ')}
          >
            {isConnected ? t('map.liveWater') : t('dashboard.socketOffline')}
          </span>
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-lg border border-primary-100 bg-white p-4 shadow-soft lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={searchDistrict}>
          <label className="form-label">
            Search district
            <input
              className="form-input"
              list="map-districts"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search Sylhet, Feni, Kurigram..."
              value={searchQuery}
            />
            <datalist id="map-districts">
              {districtOptions.map((district) => (
                <option key={district} value={district} />
              ))}
            </datalist>
          </label>
          <button className="button-primary self-end" type="submit">
            Zoom
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {layerControls.map((layer) => (
            <button
              className={[
                'rounded-md border px-3 py-2 text-sm font-bold transition',
                visibleLayers[layer.key]
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
              ].join(' ')}
              key={layer.key}
              onClick={() => toggleLayer(layer.key)}
              type="button"
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[min(72vh,680px)] overflow-hidden rounded-lg border border-primary-100 bg-white shadow-soft">
          <div ref={mapNodeRef} className="h-full" />

          <div className="absolute bottom-4 left-4 z-[400] max-w-[240px] rounded-md border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur">
            <p className="mb-2 font-semibold text-slate-900">
              {t('map.legend')}
            </p>
            <div className="grid gap-2">
              {visibleLayers.risk
                ? Object.values(riskLevels).map((risk) => (
                    <div key={risk.label} className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: risk.color }}
                      />
                      <span className="text-slate-700">
                        {t(`risk.${risk.label}`)}
                      </span>
                    </div>
                  ))
                : null}
              {visibleLayers.stations ? (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-600" />
                  <span className="text-slate-700">FFWC station</span>
                </div>
              ) : null}
              {visibleLayers.requests ? (
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-xs font-black text-white">
                    H
                  </span>
                  <span className="text-slate-700">Help request</span>
                </div>
              ) : null}
              {visibleLayers.shelters ? (
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white">
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <path d="M3 10.8 12 3l9 7.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                      <path d="M5 10v10h14V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                      <path d="M9 20v-6h6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                  </span>
                  <span className="text-slate-700">Safe shelter</span>
                </div>
              ) : null}
              {visibleLayers.ngos ? (
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-xs font-black text-white">
                    N
                  </span>
                  <span className="text-slate-700">NGO team</span>
                </div>
              ) : null}
              {visibleLayers.volunteers ? (
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">
                    V
                  </span>
                  <span className="text-slate-700">Volunteer</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-primary-100 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('map.details')}
          </p>

          {selectedDistrict ? (
            <div className="mt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    {selectedDistrict.districtName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('map.division', { division: selectedDistrict.division })}
                  </p>
                </div>
                <span
                  className={[
                    'rounded-md px-3 py-1 text-sm font-bold',
                    riskLevels[selectedDistrict.riskLevel].bgClass,
                    riskLevels[selectedDistrict.riskLevel].textClass,
                  ].join(' ')}
                >
                  {t(`risk.${selectedDistrict.riskLevel}`)}
                </span>
              </div>

              <dl className="mt-6 grid gap-4">
                <div className="rounded-md bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Live FFWC stations
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950">
                    {waterStationStatus}
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Safe shelters
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950">
                    {shelterStatus}
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('map.riverWater')}
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-slate-950">
                    {selectedDistrict.riverWaterLevel}
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('map.lastUpdated')}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950">
                    {selectedDistrict.lastUpdated}
                  </dd>
                </div>
                {latestWaterUpdate &&
                latestWaterUpdate.districtName.toLowerCase() ===
                  selectedDistrict.districtName.toLowerCase() ? (
                  <div className="rounded-md bg-primary-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                      {t('map.realtimeUpdate')}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-primary-900">
                      {t('map.realtimeUpdateBody')}
                    </dd>
                  </div>
                ) : null}
                {selectedStation ? (
                  <div className="rounded-md bg-blue-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Selected FFWC station
                    </dt>
                    <dd className="mt-2 text-sm font-semibold text-blue-950">
                      <span className="block text-base font-black">
                        {selectedStation.station}
                      </span>
                      <span className="mt-1 block">
                        {selectedStation.river} | {selectedStation.district}
                      </span>
                      <span className="mt-2 block">
                        Level {selectedStation.level}, danger{' '}
                        {selectedStation.dangerLevel}
                      </span>
                      <span className="mt-1 block">
                        {selectedStation.trend} | {selectedStation.risk} risk
                      </span>
                    </dd>
                  </div>
                ) : null}
                {selectedShelter ? (
                  <div className="rounded-md bg-emerald-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Selected safe shelter
                    </dt>
                    <dd className="mt-2 text-sm font-semibold text-emerald-950">
                      <span className="block text-base font-black">
                        {selectedShelter.name}
                      </span>
                      <span className="mt-1 block">
                        {selectedShelter.address || selectedShelter.district}
                      </span>
                      <span className="mt-2 block">
                        {selectedShelter.status} |{' '}
                        {Math.max(
                          selectedShelter.capacity - selectedShelter.occupied,
                          0,
                        )}{' '}
                        places available
                      </span>
                      <span className="mt-1 block">
                        Capacity {selectedShelter.occupied}/
                        {selectedShelter.capacity}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {selectedResponseLocation ? (
                  <div className="rounded-md bg-violet-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                      {selectedResponseLocation.label}
                    </dt>
                    <dd className="mt-2 text-sm font-semibold text-violet-950">
                      <span className="block text-base font-black">
                        {selectedResponseLocation.name}
                      </span>
                      <span className="mt-1 block">
                        {selectedResponseLocation.district}
                      </span>
                      <span className="mt-2 block">
                        {selectedResponseLocation.contact
                          ? `Contact ${selectedResponseLocation.contact}`
                          : `Status ${selectedResponseLocation.availability}`}
                      </span>
                    </dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-6 text-sm leading-6 text-slate-600">
                {t('map.hint')}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              {mapStatus}
            </div>
          )}
        </aside>
      </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

export default MapPage
