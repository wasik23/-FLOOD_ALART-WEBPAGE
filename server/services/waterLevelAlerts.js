import { Op } from 'sequelize'
import { Alert, District, WaterLevelReport } from '../models/index.js'
import { RISK_LEVELS } from '../models/District.js'
import { sendSms } from './smsGateway.js'
import { listSubscribers } from './subscriberStore.js'

const AUTO_ALERT_RISKS = new Set(['High', 'Critical'])
const DEFAULT_UNIT = 'm'
const fallbackCooldowns = new Map()
const recentWaterAlerts = []

function riskFromLevel(level) {
  if (level >= 7) return 'Critical'
  if (level >= 5) return 'High'
  if (level >= 3) return 'Medium'
  return 'Low'
}

function cooldownMs() {
  const minutes = Number.parseInt(process.env.AUTO_ALERT_COOLDOWN_MINUTES || '30', 10)
  return Math.max(1, minutes) * 60 * 1000
}

function buildMessage({ district, districtName, level, unit, riskLevel, note }) {
  const locationName = district?.name || districtName
  const location = locationName ? ` in ${locationName}` : ''
  const suffix = note ? ` Note: ${note}` : ''
  return `Flood warning${location}: water level is ${level} ${unit} and risk is ${riskLevel}. Move to a safe place and follow local authority instructions.${suffix}`
}

function emit(app, eventName, payload) {
  const io = app.get('io')
  if (!io) return
  io.emit(eventName, {
    id: `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

function rememberCurrentWaterAlert(alert, districtName) {
  recentWaterAlerts.unshift({
    id: `water-current-${alert.id}`,
    timestamp: alert.issuedAt || new Date().toISOString(),
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    district: districtName || 'Bangladesh',
    districtId: alert.districtId || null,
  })

  recentWaterAlerts.splice(20)
}

async function findDistrict({ districtId, district }) {
  if (districtId) return District.findByPk(districtId)
  if (typeof district === 'string' && district.trim()) {
    return District.findOne({ where: { name: district.trim() } })
  }
  return null
}

async function recentAlertExists({ districtId, severity }) {
  const issuedAfter = new Date(Date.now() - cooldownMs())
  const where = {
    severity,
    issuedAt: { [Op.gt]: issuedAfter },
  }

  if (districtId) {
    where.districtId = districtId
  } else {
    where.districtId = null
  }

  const recent = await Alert.findOne({ where })
  return Boolean(recent)
}

async function sendSmsToSubscribers({ district, districtName, upazila, message }) {
  const targets = await listSubscribers({
    district: district?.name || districtName,
    upazila: typeof upazila === 'string' && upazila.trim() ? upazila.trim() : undefined,
  })

  if (targets.length === 0) {
    return { sent: 0, failed: 0, total: 0, results: [] }
  }

  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const result = await sendSms({ phone: target.phone, message })
        return { phone: target.phone, status: 'sent', ...result }
      } catch (error) {
        return { phone: target.phone, status: 'failed', error: error.message }
      }
    }),
  )

  const sent = results.filter((result) => result.status === 'sent').length
  return {
    sent,
    failed: results.length - sent,
    total: results.length,
    results,
  }
}

export function deriveWaterRisk({ level, riskLevel }) {
  if (RISK_LEVELS.includes(riskLevel)) return riskLevel
  return riskFromLevel(Number(level))
}

export async function recordWaterLevelAndAlert({
  app,
  districtId,
  district: districtName,
  level,
  unit = DEFAULT_UNIT,
  riskLevel,
  note,
  latitude,
  longitude,
  observedAt,
  issuedById = null,
  upazila,
  saveReport = true,
  databaseOptional = false,
}) {
  const numericLevel = Number(level)
  let district = null
  let databaseWarning = null

  try {
    district = await findDistrict({ districtId, district: districtName })
  } catch (error) {
    if (!databaseOptional) {
      throw error
    }

    databaseWarning = error.message
  }

  if (!databaseWarning && districtId && !district) {
    const error = new Error(`Unknown districtId ${districtId}.`)
    error.status = 400
    error.expose = true
    throw error
  }
  const derivedRisk = deriveWaterRisk({ level: numericLevel, riskLevel })
  const observedDate = observedAt ? new Date(observedAt) : new Date()

  let report = null
  if (!databaseWarning && district && saveReport) {
    report = await WaterLevelReport.create({
      districtId: district.id,
      reportedById: issuedById,
      level: numericLevel,
      unit,
      riskLevel: derivedRisk,
      note: note || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      observedAt: observedDate,
    })

    district.riskLevel = derivedRisk
    district.riverWaterLevel = numericLevel
    district.lastAssessedAt = report.observedAt
    await district.save()
  }

  emit(app, 'water_level_update', {
    district: district?.name || districtName || 'Bangladesh',
    districtId: district?.id || null,
    riskLevel: derivedRisk,
    riverWaterLevel: `${numericLevel} ${unit}`,
    level: numericLevel,
    unit,
    observedAt: observedDate,
  })

  if (!AUTO_ALERT_RISKS.has(derivedRisk)) {
    return {
      report,
      autoAlert: null,
      sms: null,
      skipped: `Risk level ${derivedRisk} does not require offline alert delivery.`,
    }
  }

  const cooldownKey = `${district?.id || districtName || 'Bangladesh'}:${derivedRisk}`
  const fallbackSentAt = fallbackCooldowns.get(cooldownKey) || 0

  if (
    databaseWarning
      ? Date.now() - fallbackSentAt < cooldownMs()
      : await recentAlertExists({ districtId: district?.id || null, severity: derivedRisk })
  ) {
    return {
      report,
      autoAlert: null,
      sms: null,
      skipped: `A ${derivedRisk} water-level alert was already sent recently.`,
      databaseWarning,
    }
  }

  const message = buildMessage({
    district,
    districtName,
    level: numericLevel,
    unit,
    riskLevel: derivedRisk,
    note,
  }).slice(0, 480)
  const alertLocation = district?.name || districtName
  const alertTitle = `${derivedRisk} water level${alertLocation ? ` in ${alertLocation}` : ''}`
  const autoAlert = databaseWarning
    ? {
        id: `alert-${Date.now()}`,
        title: alertTitle,
        message,
        severity: derivedRisk,
        districtId: null,
        issuedById,
        issuedAt: new Date().toISOString(),
      }
    : await Alert.create({
        title: alertTitle,
        message,
        severity: derivedRisk,
        districtId: district?.id || null,
        issuedById,
      })

  if (databaseWarning) {
    fallbackCooldowns.set(cooldownKey, Date.now())
  }

  emit(app, 'new_alert', {
    district: district?.name || districtName || 'Bangladesh',
    districtId: district?.id || null,
    severity: derivedRisk,
    title: autoAlert.title,
    message: autoAlert.message,
  })
  rememberCurrentWaterAlert(autoAlert, district?.name || districtName)

  const sms = await sendSmsToSubscribers({
    district,
    districtName: districtName || undefined,
    upazila,
    message,
  })
  return { report, autoAlert, sms, skipped: null, databaseWarning }
}

export function listCurrentWaterAlerts() {
  return recentWaterAlerts
}
