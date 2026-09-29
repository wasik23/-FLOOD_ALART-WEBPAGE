/* eslint-env node */
import { Router } from 'express'

const router = Router()
const FFWC_REPORT_URL = 'http://old.ffwc.gov.bd/ffwc_charts/waterlevelfcast.php'
const FFWC_BASE_URL = 'https://ffwc-api.bdservers.site/data_load'
const REQUEST_TIMEOUT_MS = 15000
const CACHE_DURATION_MS = 5 * 60 * 1000
const RISK_WEIGHT = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
}

let cachedResponse = null
let cachedAt = 0
let pendingRefresh = null

function getPlainText(markup = '') {
  return markup
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCells(rowMarkup) {
  const cells = []
  const expression = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  let match

  while ((match = expression.exec(rowMarkup))) {
    cells.push({
      attributes: match[2],
      text: getPlainText(match[3]),
    })
  }

  return cells
}

function parseReportDate(html) {
  const match = html.match(
    /TABLE OF FORECAST WATER LEVELS\s*:\s*(\d{2})-(\d{2})-(\d{4})/i,
  )

  if (!match) throw new Error('FFWC report date was not found.')

  const [, day, month, year] = match
  return {
    iso: `${year}-${month}-${day}`,
    year: Number(year),
    month: Number(month),
  }
}

function getIsoDates(dayLabels, reportDate) {
  let year = reportDate.year
  const firstMonth = Number(dayLabels[0]?.split('-')[1])

  if (reportDate.month - firstMonth > 6) year += 1
  if (firstMonth - reportDate.month > 6) year -= 1

  let previousMonth = firstMonth
  return dayLabels.map((label, index) => {
    const [day, month] = label.split('-').map(Number)
    if (index > 0 && month < previousMonth) year += 1
    previousMonth = month

    return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
  })
}

export function parseFfwcReport(html) {
  const reportDate = parseReportDate(html)
  const tableStart = html.search(/<table\b/i)
  if (tableStart < 0) throw new Error('FFWC station table was not found.')

  // This legacy page omits its closing table tag; the next table begins the legend.
  const nextTableStart = html.toLowerCase().indexOf('<table', tableStart + 6)
  const tableMarkup = html.slice(tableStart, nextTableStart < 0 ? undefined : nextTableStart)
  const rows = (tableMarkup.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []).map(getCells)
  const hasStationHeaders = rows.some(
    (cells) =>
      cells.some((cell) => /River Name/i.test(cell.text)) &&
      cells.some((cell) => /Station/i.test(cell.text)),
  )

  if (!hasStationHeaders) throw new Error('FFWC station table headers were not found.')

  const dateRowIndex = rows.findIndex(
    (cells) => cells.filter((cell) => /^\d{2}-\d{2}$/.test(cell.text)).length >= 3,
  )
  if (dateRowIndex < 0) throw new Error('FFWC observation dates were not found.')

  const dayLabels = rows[dateRowIndex]
    .map((cell) => cell.text)
    .filter((text) => /^\d{2}-\d{2}$/.test(text))
  const groupHeader = rows
    .slice(0, dateRowIndex)
    .flat()
    .find((cell) => /WL\s*-\s*Observe/i.test(cell.text))
  const columnSpan = groupHeader?.attributes.match(
    /\bcolspan\s*=\s*["']?(\d+)/i,
  )
  const observedColumnCount = columnSpan ? Number(columnSpan[1]) : 0

  if (!observedColumnCount || !dayLabels.length) {
    throw new Error('FFWC observation columns were not identified.')
  }

  const dates = getIsoDates(dayLabels, reportDate)
  const waterLevels = []
  let basin = null

  rows.slice(dateRowIndex + 1).forEach((cells) => {
    const groupLabel = cells.length === 1 ? cells[0]?.text : ''
    if (/\bBasin$/i.test(groupLabel)) {
      basin = groupLabel.replace(/\s+Basin$/i, '').trim()
      return
    }

    const river = cells[0]?.text
    const station = cells[1]?.text
    const dangerLevel = Number(cells[2]?.text)
    if (!river || !station || !Number.isFinite(dangerLevel)) return

    const observations = dates
      .slice(0, observedColumnCount)
      .map((date, index) => ({
        date,
        value: Number(cells[index + 3]?.text),
      }))
      .filter((item) => Number.isFinite(item.value))
    if (!observations.length) return

    const forecasts = dates.slice(observedColumnCount).map((date, index) => {
      const value = Number(cells[observedColumnCount + index + 3]?.text)
      return { date, value: Number.isFinite(value) ? value : null }
    })

    waterLevels.push({
      basin,
      river,
      station,
      dangerLevel,
      latest: observations.at(-1),
      previous: observations.at(-2) || null,
      forecasts,
    })
  })

  if (!waterLevels.length) throw new Error('FFWC report contains no observed water levels.')

  return { reportDate: reportDate.iso, waterLevels }
}

async function fetchData(url, readResponse) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { Accept: 'text/html, application/json' },
    })

    if (!response.ok) throw new Error(`FFWC request failed with ${response.status}`)
    return await readResponse(response)
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeStationName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getStationMetadata(row, stations) {
  const stationName = normalizeStationName(row.station)
  const riverName = normalizeStationName(row.river)
  const exactMatch = stations.find(
    (station) =>
      normalizeStationName(station.name) === stationName &&
      normalizeStationName(station.river) === riverName,
  )
  if (exactMatch) return exactMatch

  const sameName = stations.filter(
    (station) => normalizeStationName(station.name) === stationName,
  )
  return sameName.length === 1 ? sameName[0] : null
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

function asCoordinate(value) {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate : null
}

async function loadLatestWaterLevels() {
  const [html, stations] = await Promise.all([
    fetchData(FFWC_REPORT_URL, (response) => response.text()),
    fetchData(`${FFWC_BASE_URL}/stations/`, (response) => response.json()).catch(
      () => [],
    ),
  ])
  const report = parseFfwcReport(html)

  const waterLevels = report.waterLevels
    .map((row, index) => {
      const stationInfo = getStationMetadata(row, stations)
      const distanceFromDanger = row.latest.value - row.dangerLevel
      const risk = getRiskLevel(distanceFromDanger)
      const absoluteDistance = Math.abs(distanceFromDanger).toFixed(2)
      const position =
        distanceFromDanger >= 0
          ? `${absoluteDistance} m above danger level`
          : `${absoluteDistance} m below danger level`
      const area = stationInfo?.upazilla
        ? `${stationInfo.upazilla}, ${stationInfo.district}`
        : stationInfo?.district || row.station

      return {
        id: stationInfo?.id ?? `${row.river}-${row.station}-${index}`,
        station: row.station,
        area,
        river: row.river,
        basin: row.basin || stationInfo?.basin || null,
        forecastLevels: row.forecasts.map(({ date, value }) => ({ date, value })),
        district: stationInfo?.district || null,
        division: stationInfo?.division || null,
        latitude: asCoordinate(stationInfo?.lat),
        longitude: asCoordinate(stationInfo?.long),
        level: `${row.latest.value.toFixed(2)} mMSL`,
        dangerLevel: `${row.dangerLevel.toFixed(2)} mMSL`,
        distanceFromDanger,
        risk,
        trend: getTrend(row.latest, row.previous),
        observedAt: `${row.latest.date} 06:00 BST`,
        forecast: `${row.station} on the ${row.river} was last observed ${position}.`,
      }
    })
    .sort((first, second) => {
      const riskDelta = RISK_WEIGHT[second.risk] - RISK_WEIGHT[first.risk]
      return riskDelta || second.distanceFromDanger - first.distanceFromDanger
    })

  return {
    source: 'FFWC',
    sourceUrl: FFWC_REPORT_URL,
    lastUpdated: report.reportDate,
    waterLevels,
  }
}

async function getLatestWaterLevels() {
  if (cachedResponse && Date.now() - cachedAt < CACHE_DURATION_MS) {
    return cachedResponse
  }
  if (pendingRefresh) return pendingRefresh

  pendingRefresh = loadLatestWaterLevels()
  try {
    cachedResponse = await pendingRefresh
    cachedAt = Date.now()
    return cachedResponse
  } finally {
    pendingRefresh = null
  }
}

router.get('/water-levels', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=300')
    res.json(await getLatestWaterLevels())
  } catch (error) {
    next(error)
  }
})

export default router
