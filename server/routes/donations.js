/* eslint-env node */
import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { DonationAccount, DonationReceipt, User, sequelize } from '../models/index.js'
import { DONATION_CHANNELS, DONATION_STATUSES } from '../models/DonationReceipt.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()

function publicDonorName(receipt) {
  if (receipt.isAnonymous !== false && receipt.isAnonymous !== 0) return 'Anonymous'
  const names = (receipt.donorName || '').trim().split(/\s+/).filter(Boolean)
  if (!names.length) return 'Anonymous'
  return names.length === 1 ? names[0] : `${names[0]} ${Array.from(names.at(-1))[0]}.`
}

function notifyDonationChange(req) {
  req.app.get('io')?.emit('donation_update', { updatedAt: new Date().toISOString() })
}

router.get('/live', [
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
], handleValidation, async (req, res, next) => {
  try {
    const receipts = await DonationReceipt.findAll({
      attributes: ['id', 'amount', 'donorName', 'isAnonymous', 'receivedAt'],
      where: { status: 'Received' },
      order: [['receivedAt', 'DESC'], ['createdAt', 'DESC']],
      limit: req.query.limit || 4,
      raw: true,
    })
    res.set('Cache-Control', 'no-store')
    res.json({
      donations: receipts.map((receipt) => ({
        id: receipt.id,
        displayName: publicDonorName(receipt),
        amount: String(receipt.amount),
        receivedAt: receipt.receivedAt,
      })),
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/receipts', requireAuth, requireRole('admin', 'coordinator'), [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], handleValidation, async (req, res, next) => {
  try {
    const page = req.query.page || 1
    const limit = req.query.limit || 25
    const { count, rows } = await DonationReceipt.findAndCountAll({
      include: [{ model: User, as: 'recordedBy', attributes: ['id', 'name'] }],
      order: [['receivedAt', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    })
    res.json({ count, page, limit, pages: Math.ceil(count / limit), receipts: rows })
  } catch (error) {
    next(error)
  }
})

router.post('/receipts', requireAuth, requireRole('admin', 'coordinator'), [
  body('amount').custom((value) =>
    ['string', 'number'].includes(typeof value) &&
    /^\d{1,12}(?:\.\d{1,2})?$/.test(String(value)) && Number(value) > 0,
  ).withMessage('Enter a positive BDT amount with at most two decimal places.'),
  body('reference').isString().trim().isLength({ min: 1, max: 120 }),
  body('donorName').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('isAnonymous').optional().isBoolean().toBoolean(),
  body('channel').isIn(DONATION_CHANNELS),
  body('receivedAt').optional().isISO8601().bail().custom((value) => new Date(value).getTime() <= Date.now() + 60000)
    .withMessage('Received time cannot be in the future.').toDate(),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
], handleValidation, async (req, res, next) => {
  try {
    const { amount, reference, donorName, isAnonymous, channel, receivedAt, notes } = req.body
    const receipt = await DonationReceipt.create({
      amount: String(amount), reference, donorName: donorName || null, channel,
      isAnonymous: isAnonymous ?? true,
      ...(receivedAt && { receivedAt }),
      notes: notes || null,
      status: 'Received',
      recordedById: req.user.id,
      updatedById: req.user.id,
    })
    notifyDonationChange(req)
    res.status(201).json({ receipt })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A donation with this reference is already recorded.' })
    }
    return next(error)
  }
})

router.patch('/receipts/:id', requireAuth, requireRole('admin', 'coordinator'), [
  param('id').isUUID(),
  body('status').optional().isIn(DONATION_STATUSES),
  body('isAnonymous').optional().isBoolean().toBoolean(),
  body().custom((value) => value.status !== undefined || value.isAnonymous !== undefined)
    .withMessage('Provide a receipt status or an anonymity preference.'),
], handleValidation, async (req, res, next) => {
  try {
    const receipt = await DonationReceipt.findByPk(req.params.id)
    if (!receipt) return res.status(404).json({ error: 'Donation receipt not found.' })
    await receipt.update({
      ...(req.body.status !== undefined && { status: req.body.status }),
      ...(req.body.isAnonymous !== undefined && { isAnonymous: req.body.isAnonymous }),
      updatedById: req.user.id,
    })
    notifyDonationChange(req)
    return res.json({ receipt })
  } catch (error) {
    return next(error)
  }
})

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
  body('accounts.*.isActive').optional().isBoolean().toBoolean(),
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
