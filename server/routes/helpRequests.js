/* eslint-env node */
import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { HelpRequest, User, VolunteerProfile, AuditEntry, sequelize, HELP_NEED_TYPES, HELP_REQUEST_STATUSES } from '../models/index.js'
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
      const { name, phone, district, upazila, address, needType, peopleCount, notes } = req.body
      const request = await HelpRequest.create({
        name, phone, district, upazila, address, needType, peopleCount,
        notes: notes || null,
        status: 'Pending',
        familiesHelped: 0,
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
    body('familiesHelped').optional().isInt({ min: 0, max: 10000 }).toInt(),
    body('assignedToId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const request = await sequelize.transaction(async (transaction) => {
        const record = await HelpRequest.findByPk(req.params.id, { transaction, lock: transaction.LOCK?.UPDATE })
        const fail = (status, message) => { const error = new Error(message); error.status = status; error.expose = true; throw error }
        if (!record) fail(404, 'Help request not found.')
        const status = req.body.status ?? record.status
        const familiesHelped = req.body.familiesHelped ?? record.familiesHelped
        if (status === 'Completed' && familiesHelped < 1) fail(400, 'Record the number of families helped before completing this request.')
        if (req.body.assignedToId) {
          const assignee = await User.findByPk(req.body.assignedToId, { transaction })
          const profile = await VolunteerProfile.findOne({ where: { userId: req.body.assignedToId, isActive: true, verified: true, availability: 'Available' }, transaction })
          if (!assignee || assignee.role !== 'volunteer' || !assignee.isActive || !profile) fail(400, 'Choose an active, verified and available volunteer.')
        }
        await record.update({
          status, familiesHelped,
          ...(req.body.assignedToId !== undefined && { assignedToId: req.body.assignedToId }),
        }, { transaction })
        await AuditEntry.create({ actorId: req.user.id, action: 'Help request updated', detail: `${record.id}: ${status}, ${familiesHelped} families helped.` }, { transaction })
        return record
      })
      return res.json({ request })
    } catch (error) {
      return next(error)
    }
  },
)

export default router
