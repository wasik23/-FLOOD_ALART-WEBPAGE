/* eslint-env node */
import { Router } from 'express'
import { body } from 'express-validator'
import {
  WaterLevelReport,
  District,
  Alert,
} from '../models/index.js'
import { RISK_LEVELS } from '../models/District.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()

function emit(req, eventName, payload) {
  const io = req.app.get('io')
  if (!io) return
  io.emit(eventName, {
    id: `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

// POST /api/reports/water-level — volunteers, coordinators, admins.
router.post(
  '/water-level',
  requireAuth,
  requireRole('volunteer', 'coordinator', 'admin'),
  [
    body('districtId').isInt({ min: 1 }).toInt(),
    body('level').isFloat({ min: 0, max: 50 }).toFloat(),
    body('unit').optional().isIn(['m', 'ft']),
    body('riskLevel').optional().isIn(RISK_LEVELS),
    body('note').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
    body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).toFloat(),
    body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).toFloat(),
    body('observedAt').optional().isISO8601().toDate(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const {
        districtId,
        level,
        unit,
        riskLevel,
        note,
        latitude,
        longitude,
        observedAt,
      } = req.body

      const district = await District.findByPk(districtId)
      if (!district) {
        return res.status(400).json({ error: `Unknown districtId ${districtId}.` })
      }

      const derivedRisk =
        riskLevel ||
        (level >= 7 ? 'Critical' : level >= 5 ? 'High' : level >= 3 ? 'Medium' : 'Low')

      const report = await WaterLevelReport.create({
        districtId,
        reportedById: req.user.id,
        level,
        unit: unit || 'm',
        riskLevel: derivedRisk,
        note: note || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        observedAt: observedAt || new Date(),
      })

      // Update the district's current snapshot.
      district.riskLevel = derivedRisk
      district.riverWaterLevel = level
      district.lastAssessedAt = report.observedAt
      await district.save()

      emit(req, 'water_level_update', {
        district: district.name,
        riskLevel: derivedRisk,
        riverWaterLevel: `${level} ${unit || 'm'}`,
      })

      // Auto-issue a Critical alert when risk escalates to Critical.
      let autoAlert = null
      if (derivedRisk === 'Critical') {
        autoAlert = await Alert.create({
          title: `Critical water level in ${district.name}`,
          message: `Water level has reached ${level} ${unit || 'm'} (${derivedRisk}).`,
          severity: 'Critical',
          districtId: district.id,
          issuedById: req.user.id,
        })
        emit(req, 'new_alert', {
          district: district.name,
          severity: 'Critical',
          title: autoAlert.title,
          message: autoAlert.message,
        })
      }

      return res.status(201).json({ report, autoAlert })
    } catch (err) {
      return next(err)
    }
  },
)

export default router
