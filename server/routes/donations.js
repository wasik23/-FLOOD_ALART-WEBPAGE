/* eslint-env node */
import { Router } from 'express'
import { body } from 'express-validator'
import { DonationAccount, sequelize } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const accounts = await DonationAccount.findAll({
      where: { isActive: true },
      order: [['type', 'ASC'], ['label', 'ASC']],
    })
    return res.json({ count: accounts.length, accounts })
  } catch (error) {
    return next(error)
  }
})

router.put('/', requireAuth, requireRole('admin', 'coordinator'), [
  body('accounts').isArray({ min: 1, max: 50 }),
  body('accounts.*.id').isString().trim().isLength({ min: 1, max: 80 }),
  body('accounts.*.type').isString().trim().isLength({ min: 1, max: 80 }),
  body('accounts.*.label').isString().trim().isLength({ min: 1, max: 100 }),
  body('accounts.*.accountName').isString().trim().isLength({ min: 1, max: 160 }),
  body('accounts.*.accountNumber').isString().trim().isLength({ min: 1, max: 100 }),
  body('accounts.*.branch').optional({ nullable: true }).isString().trim().isLength({ max: 160 }),
  body('accounts.*.instructions').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
], handleValidation, async (req, res, next) => {
  try {
    await sequelize.transaction(async (transaction) => {
      for (const account of req.body.accounts) {
        await DonationAccount.upsert(
          { ...account, isActive: account.isActive ?? true, updatedById: req.user.id },
          { transaction },
        )
      }
    })
    const accounts = await DonationAccount.findAll({ order: [['type', 'ASC'], ['label', 'ASC']] })
    return res.json({ count: accounts.length, accounts })
  } catch (error) {
    return next(error)
  }
})

export default router
