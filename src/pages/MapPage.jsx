import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import {
  getDistrictFloodRisk,
  getDistrictName,
  riskLevels,
} from '../utils/floodRisk.js'
import useSocket from '../hooks/useSocket.js'
import { createBangladeshMap } from '../utils/map.js'
import { cacheDistrictRiskSnapshot } from '../utils/offlineRiskSnapshot.js'

function MapPage() {
  const { i18n, t } = useTranslation()
  const mapNodeRef = useRef(null)
  const mapRef = useRef(null)
  const geoJsonLayerRef = useRef(null)
  const selectedLayerRef = useRef(null)
  const waterLevelUpdatesRef = useRef({})
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [districtCount, setDistrictCount] = useState(0)
  const [mapStatus, setMapStatus] = useState(t('map.loading'))
  const [latestWaterUpdate, setLatestWaterUpdate] = useState(null)
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
        const riskSnapshot = geoJson.features.map((feature) =>
          getFeatureRisk(feature),
        )
        cacheDistrictRiskSnapshot(riskSnapshot).catch(() => {})

        const districtLayer = L.geoJSON(geoJson, {
          style: (feature) => {
            const risk = getFeatureRisk(feature)

            return {
              color: '#ffffff',
              fillColor: risk.color,
              fillOpacity: 0.72,
              opacity: 0.95,
              weight: 1,
            }
          },
          onEachFeature: (feature, layer) => {
            const risk = getFeatureRisk(feature)

            layer.bindTooltip(risk.districtName, {
              direction: 'center',
              opacity: 0.92,
              sticky: true,
            })

            layer.on({
              click: () => {
                const currentRisk = getFeatureRisk(feature)

                if (selectedLayerRef.current) {
                  geoJsonLayerRef.current.resetStyle(selectedLayerRef.current)
                }

                selectedLayerRef.current = layer
                layer.setStyle({
                  color: '#111827',
                  fillOpacity: 0.9,
                  weight: 3,
                })
                setSelectedDistrict(currentRisk)
                setLatestWaterUpdate(
                  waterLevelUpdatesRef.current[
                    currentRisk.districtName.toLowerCase()
                  ] || null,
                )
                map.fitBounds(layer.getBounds(), {
                  maxZoom: 10,
                  padding: [28, 28],
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
      selectedLayerRef.current = null
    }
  }, [getFeatureRisk, t])

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[min(72vh,680px)] overflow-hidden rounded-lg border border-primary-100 bg-white shadow-soft">
          <div ref={mapNodeRef} className="h-full" />

          <div className="absolute bottom-4 left-4 z-[400] rounded-md border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur">
            <p className="mb-2 font-semibold text-slate-900">
              {t('map.legend')}
            </p>
            <div className="grid gap-2">
              {Object.values(riskLevels).map((risk) => (
                <div key={risk.label} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: risk.color }}
                  />
                  <span className="text-slate-700">
                    {t(`risk.${risk.label}`)}
                  </span>
                </div>
              ))}
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
