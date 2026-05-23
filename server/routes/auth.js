/* eslint-env node */
import { Router } from 'express'
import { body } from 'express-validator'
import { User, District, USER_ROLES } from '../models/index.js'
import { handleValidation } from '../middleware/validate.js'
import { signToken, requireAuth } from '../middleware/auth.js'

const router = Router()

router.post(
  '/register',
  [
    body('name').isString().trim().isLength({ min: 2, max: 120 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }),
    body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
    body('role').optional().isIn(USER_ROLES.filter((r) => r !== 'admin')),
    body('districtId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { name, email, password, phone, role, districtId } = req.body

      if (districtId) {
        const district = await District.findByPk(districtId)
        if (!district) {
          return res.status(400).json({ error: `Unknown districtId ${districtId}.` })
        }
      }

      const existing = await User.findOne({ where: { email } })
      if (existing) {
        return res.status(409).json({ error: 'Email is already registered.' })
      }

      const user = await User.create({
        name,
        email,
        phone: phone || null,
        passwordHash: password,
        role: role || 'citizen',
        districtId: districtId || null,
      })

      const token = signToken(user)
      return res.status(201).json({ token, user: user.toSafeJSON() })
    } catch (err) {
      return next(err)
    }
  },
)

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, password } = req.body
      const user = await User.findOne({ where: { email } })
      if (!user || !(await user.verifyPassword(password))) {
        return res.status(401).json({ error: 'Invalid email or password.' })
      }
      const token = signToken(user)
      return res.json({ token, user: user.toSafeJSON() })
    } catch (err) {
      return next(err)
    }
  },
)

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() })
})

export default router
