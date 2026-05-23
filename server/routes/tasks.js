/* eslint-env node */
import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { Task, District, User, TASK_PRIORITIES, TASK_STATUSES } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()

function emitTaskEvent(req, eventName, payload) {
  const io = req.app.get('io')
  if (!io) return
  io.emit(eventName, {
    id: `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

// GET /api/tasks — authenticated, with filtering.
router.get(
  '/',
  requireAuth,
  [
    query('status').optional().isIn(TASK_STATUSES),
    query('districtId').optional().isInt({ min: 1 }).toInt(),
    query('mine').optional().isBoolean().toBoolean(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const where = {}
      if (req.query.status) where.status = req.query.status
      if (req.query.districtId) where.districtId = req.query.districtId
      if (req.query.mine === true) where.assignedToId = req.user.id

      const tasks = await Task.findAll({
        where,
        include: [
          { model: District, as: 'district', attributes: ['id', 'name', 'riskLevel'] },
          { model: User, as: 'assignedTo', attributes: ['id', 'name', 'role'] },
          { model: User, as: 'createdBy', attributes: ['id', 'name', 'role'] },
        ],
        order: [['createdAt', 'DESC']],
      })
      res.json({ count: tasks.length, tasks })
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/tasks — admin/coordinator only.
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'coordinator'),
  [
    body('title').isString().trim().isLength({ min: 3, max: 180 }),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
    body('districtId').isInt({ min: 1 }).toInt(),
    body('priority').optional().isIn(TASK_PRIORITIES),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { title, description, districtId, priority } = req.body

      const district = await District.findByPk(districtId)
      if (!district) {
        return res.status(400).json({ error: `Unknown districtId ${districtId}.` })
      }

      const task = await Task.create({
        title,
        description: description || null,
        districtId,
        priority: priority || 'Medium',
        createdById: req.user.id,
      })

      emitTaskEvent(req, 'new_task', {
        taskId: task.id,
        taskTitle: task.title,
        district: district.name,
        priority: task.priority,
      })

      return res.status(201).json({ task })
    } catch (err) {
      return next(err)
    }
  },
)

// PUT /api/tasks/:id/accept — volunteers (and coordinators/admins) accept a task.
router.put(
  '/:id/accept',
  requireAuth,
  requireRole('volunteer', 'coordinator', 'admin'),
  [param('id').isInt({ min: 1 }).toInt()],
  handleValidation,
  async (req, res, next) => {
    try {
      const task = await Task.findByPk(req.params.id, {
        include: [{ model: District, as: 'district', attributes: ['id', 'name'] }],
      })
      if (!task) return res.status(404).json({ error: 'Task not found.' })

      if (task.status !== 'Open') {
        return res.status(409).json({
          error: `Task is ${task.status}; only Open tasks can be accepted.`,
        })
      }

      task.status = 'Accepted'
      task.assignedToId = req.user.id
      task.acceptedAt = new Date()
      await task.save()

      emitTaskEvent(req, 'volunteer_accepted_task', {
        taskId: task.id,
        taskTitle: task.title,
        volunteerName: req.user.name,
        district: task.district?.name,
        status: 'Accepted',
      })

      return res.json({ task })
    } catch (err) {
      return next(err)
    }
  },
)

export default router
