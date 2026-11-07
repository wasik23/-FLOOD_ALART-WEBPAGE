/* eslint-env node */
import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { HelpRequest, User, HELP_NEED_TYPES, HELP_REQUEST_STATUSES } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()
const pageRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
]

router.post(
  '/',
  [
    body('name').isString().trim().isLength({ min: 2, max: 120 }),
    body('phone').isString().trim().isLength({ min: 7, max: 20 }),
    body('district').isString().trim().isLength({ min: 2, max: 80 }),
    body('upazila').isString().trim().isLength({ min: 2, max: 120 }),
    body('address').isString().trim().isLength({ min: 3, max: 500 }),
    body('needType').isIn(HELP_NEED_TYPES),
    body('peopleCount').isInt({ min: 1, max: 10000 }).toInt(),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const request = await HelpRequest.create({
        ...req.body,
        notes: req.body.notes || null,
        status: 'Pending',
      })
      return res.status(201).json({ request })
    } catch (error) {
      return next(error)
    }
  },
)

router.get(
  '/',
  requireAuth,
  requireRole('admin', 'coordinator'),
  [
    ...pageRules,
    query('status').optional().isIn(HELP_REQUEST_STATUSES),
    query('district').optional().isString().trim().isLength({ max: 80 }),
    query('needType').optional().isIn(HELP_NEED_TYPES),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const page = req.query.page || 1
      const limit = req.query.limit || 25
      const where = {}
      if (req.query.status) where.status = req.query.status
      if (req.query.district) where.district = req.query.district
      if (req.query.needType) where.needType = req.query.needType
      const { count, rows } = await HelpRequest.findAndCountAll({
        where,
        include: [{ model: User, as: 'assignedTo', attributes: ['id', 'name', 'role'] }],
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit,
      })
      return res.json({ count, page, limit, pages: Math.ceil(count / limit), requests: rows })
    } catch (error) {
      return next(error)
    }
  },
)

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'coordinator'),
  [
    param('id').isUUID(),
    body('status').optional().isIn(HELP_REQUEST_STATUSES),
    body('assignedToId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const request = await HelpRequest.findByPk(req.params.id)
      if (!request) return res.status(404).json({ error: 'Help request not found.' })
      if (req.body.assignedToId) {
        const assignee = await User.findByPk(req.body.assignedToId)
        if (!assignee) return res.status(400).json({ error: 'Unknown assignedToId.' })
      }
      await request.update({
        ...(req.body.status !== undefined && { status: req.body.status }),
        ...(req.body.assignedToId !== undefined && { assignedToId: req.body.assignedToId }),
      })
      return res.json({ request })
    } catch (error) {
      return next(error)
    }
  },
)

export default router
