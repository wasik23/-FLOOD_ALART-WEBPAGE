/* eslint-env node */
import { Router } from 'express'
import { body, query } from 'express-validator'
import { Shelter, District } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()

// GET /api/shelters — public listing, optionally filtered by district.
router.get(
  '/',
  [query('districtId').optional().isInt({ min: 1 }).toInt(), query('active').optional().isBoolean().toBoolean()],
  handleValidation,
  async (req, res, next) => {
    try {
      const where = {}
      if (req.query.districtId) where.districtId = req.query.districtId
      if (typeof req.query.active === 'boolean') where.isActive = req.query.active

      const shelters = await Shelter.findAll({
        where,
        include: [{ model: District, as: 'district', attributes: ['id', 'name', 'riskLevel'] }],
        order: [['createdAt', 'DESC']],
      })
      res.json({ count: shelters.length, shelters })
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/shelters — restricted to admin/coordinator.
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'coordinator'),
  [
    body('name').isString().trim().isLength({ min: 2, max: 160 }),
    body('districtId').isInt({ min: 1 }).toInt(),
    body('capacity').isInt({ min: 0 }).toInt(),
    body('occupancy').optional().isInt({ min: 0 }).toInt(),
    body('address').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
    body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).toFloat(),
    body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).toFloat(),
    body('isActive').optional().isBoolean().toBoolean(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const {
        name,
        districtId,
        capacity,
        occupancy = 0,
        address,
        latitude,
        longitude,
        isActive,
      } = req.body

      const district = await District.findByPk(districtId)
      if (!district) {
        return res.status(400).json({ error: `Unknown districtId ${districtId}.` })
      }
      if (occupancy > capacity) {
        return res.status(400).json({ error: 'occupancy cannot exceed capacity.' })
      }

      const shelter = await Shelter.create({
        name,
        districtId,
        capacity,
        occupancy,
        address: address || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        isActive: isActive ?? true,
        createdById: req.user.id,
      })

      return res.status(201).json({ shelter })
    } catch (err) {
      return next(err)
    }
  },
)

export default router
