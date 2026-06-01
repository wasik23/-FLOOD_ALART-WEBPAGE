/* eslint-env node */
import { Router } from 'express'

const router = Router()
const FFWC_BASE_URL = 'https://ffwc-api.bdservers.site/data_load'
const RISK_WEIGHT = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
}

async function loadFfwcJson(path) {
  const response = await fetch(`${FFWC_BASE_URL}/${path}/`)

  if (!response.ok) {
    throw new Error(`FFWC ${path} request failed with ${response.status}`)
  }

  return response.json()
}

function getLatestObservation(observations = []) {
  const latest = observations
    .map((item) => {
      const [timestamp, value] = Object.entries(item)[0] || []
      return {
        timestamp,
        value: Number(value),
      }
    })
    .filter((item) => item.timestamp && Number.isFinite(item.value))
    .at(-1)

  return latest || null
}

function getPreviousObservation(observations = []) {
  const parsed = observations
    .map((item) => {
      const [timestamp, value] = Object.entries(item)[0] || []
      return {
        timestamp,
        value: Number(value),
      }
    })
    .filter((item) => item.timestamp && Number.isFinite(item.value))

  return parsed.length > 1 ? parsed.at(-2) : null
}

function getRiskLevel(distanceFromDanger) {
  if (distanceFromDanger >= 1) return 'Critical'
  if (distanceFromDanger >= 0) return 'High'
  if (distanceFromDanger >= -0.5) return 'Medium'
  return 'Low'
}

function getTrend(latest, previous) {
  if (!latest || !previous) return 'Stable'
  const delta = latest.value - previous.value

  if (delta > 0.02) return 'Rising'
  if (delta < -0.02) return 'Falling'
  return 'Stable'
}

router.get('/water-levels', async (_req, res, next) => {
  try {
    const [stations, recentObserved, updateDate] = await Promise.all([
      loadFfwcJson('stations'),
      loadFfwcJson('recent-observed'),
      loadFfwcJson('update-date'),
    ])

    const waterLevels = stations
      .map((station) => {
        const latest = getLatestObservation(recentObserved[String(station.id)])
        const previous = getPreviousObservation(recentObserved[String(station.id)])
        const dangerLevel = Number(station.dangerlevel)

        if (!latest || !Number.isFinite(dangerLevel)) return null

        const distanceFromDanger = latest.value - dangerLevel
        const risk = getRiskLevel(distanceFromDanger)
        const absoluteDistance = Math.abs(distanceFromDanger).toFixed(2)
        const position =
          distanceFromDanger >= 0
            ? `${absoluteDistance} m above danger level`
            : `${absoluteDistance} m below danger level`

        return {
          id: station.id,
          station: station.name,
          area: station.upazilla
            ? `${station.upazilla}, ${station.district}`
            : station.district,
          river: station.river,
          basin: station.basin,
          district: station.district,
          division: station.division,
          latitude: Number(station.lat),
          longitude: Number(station.long),
          level: `${latest.value.toFixed(2)} m`,
          dangerLevel: `${dangerLevel.toFixed(2)} m`,
          distanceFromDanger,
          risk,
          trend: getTrend(latest, previous),
          observedAt: latest.timestamp,
          forecast: `${station.name} on the ${station.river} is ${position}.`,
        }
      })
      .filter(Boolean)
      .sort((first, second) => {
        const riskDelta = RISK_WEIGHT[second.risk] - RISK_WEIGHT[first.risk]
        return riskDelta || second.distanceFromDanger - first.distanceFromDanger
      })
      .slice(0, 40)

    res.json({
      source: 'FFWC',
      lastUpdated: updateDate.last_update_date || updateDate.entry_date || null,
      waterLevels,
    })
  } catch (error) {
    next(error)
  }
})

export default router
