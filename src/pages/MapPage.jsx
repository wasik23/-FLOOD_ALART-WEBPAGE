import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import {
  getDistrictFloodRisk,
  getDistrictName,
  riskLevels,
} from '../utils/floodRisk.js'
import { getHelpRequests } from '../data/reliefData.js'
import useSocket from '../hooks/useSocket.js'
import { getLiveWaterLevels } from '../services/ffwc.js'
import { createBangladeshMap } from '../utils/map.js'
import { cacheDistrictRiskSnapshot } from '../utils/offlineRiskSnapshot.js'

const layerControls = [
  { key: 'risk', label: 'Flood risk' },
  { key: 'stations', label: 'FFWC stations' },
  { key: 'requests', label: 'Help requests' },
]

const requestStatusStyles = {
  Pending: '#F59E0B',
  Assigned: '#2563EB',
  Completed: '#16A34A',
}

function getStationColor(risk) {
  return riskLevels[risk]?.color || '#2563EB'
}

function getRequestColor(status) {
  return requestStatusStyles[status] || '#7C3AED'
}

function MapPage() {
  const { i18n, t } = useTranslation()
  const mapNodeRef = useRef(null)
  const mapRef = useRef(null)
  const geoJsonLayerRef = useRef(null)
  const ffwcLayerRef = useRef(null)
  const requestLayerRef = useRef(null)
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
  const [visibleLayers, setVisibleLayers] = useState({
    requests: true,
    risk: true,
    stations: true,
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
        const marker = L.circleMarker(center, {
          color: '#ffffff',
          fillColor: getRequestColor(status),
          fillOpacity: 0.9,
          radius: Math.min(18, 7 + requests.length * 2),
          weight: 2,
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

  return (
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
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-slate-700">Help request</span>
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
  )
}

export default MapPage
