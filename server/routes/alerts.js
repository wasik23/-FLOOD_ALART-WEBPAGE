import { Router } from 'express'
import { body, query } from 'express-validator'
import { Op } from 'sequelize'
import { Alert, District, ALERT_SEVERITIES } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'
import { sendSms } from '../services/smsGateway.js'
import {
  listSubscribers,
  upsertSubscriber,
} from '../services/subscriberStore.js'

const router = Router()

// GET /api/alerts — public; latest alerts with optional filters.
router.get(
  '/',
  [
    query('severity').optional().isIn(ALERT_SEVERITIES),
    query('districtId').optional().isInt({ min: 1 }).toInt(),
    query('activeOnly').optional().isBoolean().toBoolean(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const where = {}
      if (req.query.severity) where.severity = req.query.severity
      if (req.query.districtId) where.districtId = req.query.districtId
      if (req.query.activeOnly === true) {
        where[Op.or] = [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
      }

      const alerts = await Alert.findAll({
        where,
        include: [{ model: District, as: 'district', attributes: ['id', 'name', 'riskLevel'] }],
        order: [['issuedAt', 'DESC']],
        limit: req.query.limit || 50,
      })
      res.json({ count: alerts.length, alerts })
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/alerts — admin/coordinator can issue a new alert.
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'coordinator'),
  [
    body('title').isString().trim().isLength({ min: 3, max: 180 }),
    body('message').isString().trim().isLength({ min: 3, max: 2000 }),
    body('severity').optional().isIn(ALERT_SEVERITIES),
    body('districtId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('expiresAt').optional({ nullable: true }).isISO8601().toDate(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { title, message, severity, districtId, expiresAt } = req.body
      if (districtId) {
        const exists = await District.findByPk(districtId)
        if (!exists) {
          return res.status(400).json({ error: `Unknown districtId ${districtId}.` })
        }
      }
      const alert = await Alert.create({
        title,
        message,
        severity: severity || 'Medium',
        districtId: districtId || null,
        expiresAt: expiresAt || null,
        issuedById: req.user.id,
      })

      const io = req.app.get('io')
      if (io) {
        io.emit('new_alert', {
          id: `alert-${alert.id}`,
          timestamp: alert.issuedAt,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          districtId: alert.districtId,
        })
      }

      res.status(201).json({ alert })
    } catch (err) {
      next(err)
    }
  },
)
const brand = () => process.env.SMS_BRAND || 'ReliefOps'

// Bangladesh mobile: 88 01[3-9] XXXXXXXX (13 digits after normalisation).
const phonePattern = /^8801[3-9]\d{8}$/

function normalisePhone(input) {
  if (typeof input !== 'string') return null
  const trimmed = input.replace(/[\s-]/g, '')
  const withoutPlus = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed
  if (withoutPlus.startsWith('88')) return withoutPlus
  if (withoutPlus.startsWith('0')) return `88${withoutPlus}`
  if (withoutPlus.startsWith('1')) return `88${withoutPlus}`
  return withoutPlus
}

router.post('/subscribe', async (req, res) => {
  const { phone, district, upazila, name } = req.body ?? {}

  const normalised = normalisePhone(phone)
  if (!normalised || !phonePattern.test(normalised)) {
    return res.status(400).json({
      error: 'A valid Bangladesh mobile number is required (e.g. 01712345678).',
    })
  }
  if (typeof district !== 'string' || !district.trim()) {
    return res.status(400).json({ error: 'District is required.' })
  }
  if (typeof upazila !== 'string' || !upazila.trim()) {
    return res.status(400).json({ error: 'Upazila is required.' })
  }

  const cleanName =
    typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : null

  try {
    const subscription = await upsertSubscriber({
      phone: normalised,
      district: district.trim(),
      upazila: upazila.trim(),
      name: cleanName,
    })

    const greeting = cleanName ? `Hi ${cleanName}, ` : ''
    const confirmMessage =
      `${greeting}You are subscribed to ${brand()} flood alerts for ` +
      `${subscription.upazila}, ${subscription.district}. Reply STOP to opt out.`

    let confirmationSms = null
    try {
      confirmationSms = await sendSms({
        phone: normalised,
        message: confirmMessage,
      })
    } catch (smsError) {
      console.warn('[alerts] confirmation SMS failed:', smsError.message)
    }

    return res.status(201).json({
      ok: true,
      subscription,
      confirmationSms,
    })
  } catch (error) {
    console.error('[alerts/subscribe] failed:', error)
    return res.status(500).json({ error: 'Could not save subscription.' })
  }
})

router.post('/send', async (req, res) => {
  const { message, district, upazila, phones } = req.body ?? {}

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' })
  }
  const body = message.trim().slice(0, 480)

  let targets
  if (Array.isArray(phones) && phones.length > 0) {
    targets = phones
      .map(normalisePhone)
      .filter((value) => value && phonePattern.test(value))
      .map((phone) => ({ phone }))
  } else {
    targets = await listSubscribers({
      district: typeof district === 'string' ? district.trim() || undefined : undefined,
      upazila: typeof upazila === 'string' ? upazila.trim() || undefined : undefined,
    })
  }

  if (targets.length === 0) {
    return res.status(404).json({ error: 'No subscribers match the filters.' })
  }

  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const result = await sendSms({ phone: target.phone, message: body })
        return { phone: target.phone, status: 'sent', ...result }
      } catch (error) {
        return { phone: target.phone, status: 'failed', error: error.message }
      }
    }),
  )

  const sent = results.filter((r) => r.status === 'sent').length
  return res.json({
    ok: sent > 0,
    sent,
    failed: results.length - sent,
    total: results.length,
    results,
  })
})

router.get('/subscribers', async (req, res) => {
  const subscribers = await listSubscribers({
    district: req.query.district,
    upazila: req.query.upazila,
  })
  res.json({ count: subscribers.length, subscribers })
})

export default router
