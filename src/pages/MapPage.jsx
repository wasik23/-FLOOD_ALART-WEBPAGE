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

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-slate-500"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m21 21-4.3-4.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function SignalIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-emerald-300"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M5 12a7 7 0 0 1 14 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M8.5 12a3.5 3.5 0 0 1 7 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M12 16h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  )
}

function ShelterGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-emerald-300"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M4 10.5 12 4l8 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M6 10v9h12v-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M10 19v-5h4v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
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
    if (!mapRef.current) return undefined

    if (ffwcLayerRef.current) {
      ffwcLayerRef.current.remove()
      ffwcLayerRef.current = null
    }

    if (!visibleLayers.stations) return undefined

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

    return () => {
      if (ffwcLayerRef.current) {
        ffwcLayerRef.current.remove()
        ffwcLayerRef.current = null
      }
    }
  }, [liveWaterStations, visibleLayers.stations])

  useEffect(() => {
    if (!mapRef.current) return undefined

    if (requestLayerRef.current) {
      requestLayerRef.current.remove()
      requestLayerRef.current = null
    }

    if (!visibleLayers.requests) return undefined

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

    return () => {
      if (requestLayerRef.current) {
        requestLayerRef.current.remove()
        requestLayerRef.current = null
      }
    }
  }, [helpRequests, visibleLayers.requests])

  useEffect(() => {
    if (!mapRef.current) return undefined

    if (ngoLayerRef.current) {
      ngoLayerRef.current.remove()
      ngoLayerRef.current = null
    }

    if (!visibleLayers.ngos) return undefined

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

    return () => {
      if (ngoLayerRef.current) {
        ngoLayerRef.current.remove()
        ngoLayerRef.current = null
      }
    }
  }, [visibleLayers.ngos])

  useEffect(() => {
    if (!mapRef.current) return undefined

    if (volunteerLayerRef.current) {
      volunteerLayerRef.current.remove()
      volunteerLayerRef.current = null
    }

    if (!visibleLayers.volunteers) return undefined

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

    return () => {
      if (volunteerLayerRef.current) {
        volunteerLayerRef.current.remove()
        volunteerLayerRef.current = null
      }
    }
  }, [districtCount, visibleLayers.volunteers])

  useEffect(() => {
    if (!mapRef.current) return undefined

    if (shelterLayerRef.current) {
      shelterLayerRef.current.remove()
      shelterLayerRef.current = null
    }

    if (!visibleLayers.shelters) return undefined

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

    return () => {
      if (shelterLayerRef.current) {
        shelterLayerRef.current.remove()
        shelterLayerRef.current = null
      }
    }
  }, [shelters, visibleLayers.shelters])

  return (
    <div className="min-h-screen bg-[#080d0d] text-slate-100">
      <header className="sticky top-0 z-[700] border-b border-white/[0.06] bg-[#0b1111]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" to="/">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-300/10 bg-emerald-300/10 p-2">
              <img alt="" className="h-full w-full" src="/reliefops-icon.svg" />
            </span>
            <span className="text-base font-extrabold text-white">ReliefOps</span>
          </Link>
          <nav className="order-3 flex w-full flex-wrap items-center justify-center gap-1 text-xs font-semibold text-slate-300 md:order-none md:w-auto">
            <Link className="rounded-md px-3 py-2 hover:bg-white/[0.06] hover:text-white" to="/">
              Home
            </Link>
            <Link className="rounded-md px-3 py-2 text-emerald-300 underline decoration-emerald-300 underline-offset-8" to="/map">
              Live map
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-white/[0.06] hover:text-white" to="/shelters">
              Relief centers
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-white/[0.06] hover:text-white" to="/alerts">
              Alerts
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link className="hidden items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.06] hover:text-white sm:inline-flex" to="/register">
              <VolunteerIcon />
              Volunteer
            </Link>
            <Link className="landing-button landing-button-sos rounded-md bg-[#ff5a61] px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-red-950/30 hover:bg-[#ff454f]" to="/request-help">
              SOS Help
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[calc(100vh-73px)] overflow-hidden">
          <div className="absolute inset-0">
            <div ref={mapNodeRef} className="h-full min-h-[calc(100vh-73px)] w-full" />
          </div>
          <div className="pointer-events-none absolute inset-0 z-[350] bg-[#0b1111]/20 backdrop-blur-[0.5px]" />

          <div className="relative z-[500] mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <div className="min-h-[calc(100vh-125px)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <form
                  className="grid flex-1 gap-3 rounded-2xl border border-white/[0.07] bg-[#121818]/95 p-4 shadow-2xl shadow-black/25 backdrop-blur lg:grid-cols-[220px_auto_minmax(220px,1fr)_auto] lg:items-center"
                  onSubmit={searchDistrict}
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Real-time</p>
                    <h1 className="mt-2 text-lg font-black text-white">Bangladesh flood risk map</h1>
                  </div>
                  <span
                    className={[
                      'self-center rounded-xl border px-3 py-2 text-xs font-black',
                      isConnected
                        ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300'
                        : 'border-white/10 bg-white/[0.04] text-slate-400',
                    ].join(' ')}
                  >
                    {isConnected ? 'Live feed' : 'Offline feed'}
                  </span>
                  <label className="relative flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    <SearchIcon />
                    <span className="sr-only">Search district</span>
                    <input
                      aria-label="Search district"
                      className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search Sylhet, Feni, Kurigram..."
                      value={searchQuery}
                    />
                  </label>
                  <button className="landing-button landing-button-primary rounded-2xl bg-emerald-300 px-6 py-3 text-sm font-black text-[#062018] hover:bg-emerald-200" type="submit">
                    Zoom
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.07] bg-[#121818]/95 p-3 shadow-2xl shadow-black/25 backdrop-blur xl:max-w-[330px]">
                  {layerControls.slice(0, 4).map((layer) => (
                    <button
                      className={[
                        'rounded-xl border px-3 py-2 text-xs font-black transition',
                        visibleLayers[layer.key]
                          ? 'border-emerald-300/35 bg-emerald-300/15 text-emerald-200'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white',
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

              {selectedDistrict ? (
                <div className="absolute left-1/2 top-[55%] hidden -translate-x-1/2 rounded-xl border border-red-200 bg-red-100 px-5 py-3 text-sm font-black uppercase text-red-900 shadow-2xl shadow-red-950/30 xl:block">
                  Selected: {selectedDistrict.districtName}
                </div>
              ) : null}

              <div className="absolute bottom-6 left-4 z-[520] grid gap-3 sm:left-6 lg:left-8">
                <div className="hidden w-fit grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121818]/95 shadow-2xl shadow-black/25 backdrop-blur sm:grid">
                  <button aria-label="Zoom in" className="h-14 w-14 border-b border-white/[0.06] text-3xl font-light text-white transition hover:bg-white/[0.06]" onClick={() => mapRef.current?.zoomIn()} type="button">
                    +
                  </button>
                  <button aria-label="Zoom out" className="h-14 w-14 text-3xl font-light text-white transition hover:bg-white/[0.06]" onClick={() => mapRef.current?.zoomOut()} type="button">
                    -
                  </button>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-[#121818]/95 p-5 shadow-2xl shadow-black/25 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
                    {t('map.legend')}
                  </p>
                  <div className="mt-5 grid gap-3 text-sm font-semibold">
                    {visibleLayers.risk
                      ? Object.values(riskLevels).map((risk) => (
                          <div key={risk.label} className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full shadow-lg"
                              style={{ backgroundColor: risk.color }}
                            />
                            <span className="text-slate-300">{t(`risk.${risk.label}`)}</span>
                          </div>
                        ))
                      : null}
                    {visibleLayers.stations ? (
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full bg-red-300" />
                        <span className="text-slate-300">FFWC station</span>
                      </div>
                    ) : null}
                    {visibleLayers.shelters ? (
                      <div className="flex items-center gap-3">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-300 text-xs font-black text-[#062018]">
                          H
                        </span>
                        <span className="text-slate-300">Safe shelter</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <aside className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#121818]/95 shadow-2xl shadow-black/35 backdrop-blur xl:sticky xl:top-24 xl:max-h-[calc(100vh-104px)] xl:overflow-y-auto">
              {selectedDistrict ? (
                <>
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.32em] text-slate-400">
                          {t('map.details')}
                        </p>
                        <h2 className="mt-3 text-4xl font-black leading-none text-white">
                          {selectedDistrict.districtName}
                        </h2>
                        <p className="mt-3 text-lg font-semibold text-emerald-300">
                          {t('map.division', { division: selectedDistrict.division })}
                        </p>
                      </div>
                      <span className="rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-red-100">
                        * {t(`risk.${selectedDistrict.riskLevel}`)}
                      </span>
                    </div>

                    <div className="mt-8 rounded-2xl bg-[#1c2222] p-6">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                        {t('map.riverWater')}
                      </p>
                      <div className="mt-5 flex items-end justify-between gap-4">
                        <p className="text-5xl font-black leading-none text-emerald-300">
                          {selectedDistrict.riverWaterLevel}
                        </p>
                        <span className="rounded-xl bg-red-300/10 px-3 py-2 text-sm font-black text-red-100">
                          +1.2m
                        </span>
                      </div>
                      <p className="mt-5 text-sm italic text-slate-400">
                        Rising significantly above danger level
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-[#1c2222] p-5">
                        <SignalIcon />
                        <p className="mt-5 text-3xl font-black text-white">
                          {liveWaterStations.length || 17}
                        </p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Live FFWC stations
                        </p>
                        <p className="mt-3 text-xs font-semibold text-slate-400">
                          {waterStationStatus}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#1c2222] p-5">
                        <ShelterGlyph />
                        <p className="mt-5 text-3xl font-black text-white">
                          {shelters.length || 6}
                        </p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Demo shelters
                        </p>
                        <p className="mt-3 text-xs font-semibold text-slate-400">
                          {shelterStatus}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3">
                      <Link className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 text-center text-sm font-black text-slate-200 hover:bg-white/[0.09]" to="/alerts">
                        Download Detailed Report
                      </Link>
                      <Link className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-6 py-4 text-center text-sm font-black text-emerald-300 hover:bg-emerald-300/15" to="/alerts">
                        View Inundation Forecast
                      </Link>
                    </div>

                    <p className="mt-7 text-center text-sm italic leading-6 text-slate-400">
                      {t('map.hint')}
                    </p>

                    {latestWaterUpdate &&
                    latestWaterUpdate.districtName.toLowerCase() ===
                      selectedDistrict.districtName.toLowerCase() ? (
                      <div className="mt-6 rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-5 text-sm font-semibold text-emerald-100">
                        {t('map.realtimeUpdate')}: {t('map.realtimeUpdateBody')}
                      </div>
                    ) : null}

                    {selectedStation || selectedShelter || selectedResponseLocation ? (
                      <div className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.04] p-5 text-sm font-semibold text-slate-300">
                        {selectedStation ? (
                          <p>
                            {selectedStation.station}: {selectedStation.level}, danger {selectedStation.dangerLevel}
                          </p>
                        ) : null}
                        {selectedShelter ? (
                          <p>
                            {selectedShelter.name}: {selectedShelter.status}, capacity {selectedShelter.occupied}/{selectedShelter.capacity}
                          </p>
                        ) : null}
                        {selectedResponseLocation ? (
                          <p>
                            {selectedResponseLocation.name}: {selectedResponseLocation.contact || selectedResponseLocation.availability}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between bg-[#222828] px-6 py-5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    <span>{t('map.lastUpdated')}</span>
                    <span className="text-slate-200">{selectedDistrict.lastUpdated}</span>
                  </div>
                </>
              ) : (
                <div className="p-8">
                  <p className="text-sm font-bold text-slate-300">{mapStatus}</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#080d0d]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm font-bold text-slate-400 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-3">
            <img alt="" className="h-5 w-5" src="/reliefops-icon.svg" />
            ReliefOps Bangladesh
          </p>
          <p>Copyright (c) 2026 belongs to washique234@gmail.com</p>
          <p>Contact: 01920065926</p>
          <p className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-300" />
            Systems Operational
          </p>
        </div>
      </footer>
    </div>
  )
}

export default MapPage
