/* eslint-env node */
import { Router } from 'express'
import { body } from 'express-validator'
import { District } from '../models/index.js'
import { RISK_LEVELS } from '../models/District.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'
import { recordWaterLevelAndAlert } from '../services/waterLevelAlerts.js'

const router = Router()

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

      const result = await recordWaterLevelAndAlert({
        app: req.app,
        districtId,
        level,
        unit: unit || 'm',
        riskLevel,
        note,
        latitude,
        longitude,
        observedAt: observedAt || new Date(),
        issuedById: req.user.id,
      })

      return res.status(201).json(result)
    } catch (err) {
      return next(err)
    }
  },
)

export default router
