/* eslint-env node */
import { Router } from 'express'
import { body, query } from 'express-validator'
import { VolunteerProfile, VOLUNTEER_AVAILABILITY } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()
const profileRules = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('guardianPhone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('location').optional({ nullable: true }).isString().trim().isLength({ max: 160 }),
  body('skills').optional().isArray({ max: 30 }),
  body('skills.*').isString().trim().isLength({ min: 1, max: 40 }),
  body('availability').optional().isIn(VOLUNTEER_AVAILABILITY),
  body('imageData').optional({ nullable: true }).isString().isLength({ max: 5_000_000 }),
  body('fieldReports').optional().isArray({ max: 100 }),
]

router.put('/me', requireAuth, requireRole('volunteer', 'coordinator', 'admin'), profileRules, handleValidation,
  async (req, res, next) => {
    try {
      const [profile, created] = await VolunteerProfile.findOrCreate({
        where: { userId: req.user.id },
        defaults: { ...req.body, userId: req.user.id },
      })
      if (!created) {
        await profile.update({ ...req.body, userId: req.user.id, externalUserId: profile.externalUserId })
      }
      return res.status(created ? 201 : 200).json({ profile })
    } catch (error) {
      return next(error)
    }
  })

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await VolunteerProfile.findOne({ where: { userId: req.user.id } })
    if (!profile) return res.status(404).json({ error: 'Volunteer profile not found.' })
    return res.json({ profile })
  } catch (error) {
    return next(error)
  }
})

router.get('/', requireAuth, requireRole('admin', 'coordinator'), [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('availability').optional().isIn(VOLUNTEER_AVAILABILITY),
  query('active').optional().isBoolean().toBoolean(),
], handleValidation, async (req, res, next) => {
  try {
    const page = req.query.page || 1
    const limit = req.query.limit || 25
    const where = {}
    if (req.query.availability) where.availability = req.query.availability
    if (typeof req.query.active === 'boolean') where.isActive = req.query.active
    const { count, rows } = await VolunteerProfile.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    })
    return res.json({ count, page, limit, pages: Math.ceil(count / limit), profiles: rows })
  } catch (error) {
    return next(error)
  }
})

export default router
