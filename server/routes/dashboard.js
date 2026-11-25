import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { Op, col, fn, literal } from 'sequelize'
import { Alert, AuditEntry, District, DonationReceipt, HelpRequest, Shelter, User, VolunteerProfile, sequelize } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { handleValidation } from '../middleware/validate.js'

const router = Router()
router.use(requireAuth, requireRole('admin', 'coordinator'))
const profileInclude = { model: User, as: 'user', required: true, attributes: ['id', 'name', 'role', 'districtId', 'isActive'], where: { role: 'volunteer' } }
const audit = (req, action, detail, transaction) => AuditEntry.create({ actorId: req.user.id, action, detail }, { transaction })

router.get('/overview', [
  query('districtId').optional().isInt({ min: 1 }).toInt(),
  query('status').optional().isIn(['Pending', 'Assigned', 'Completed', 'Cancelled']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('q').optional().isString().trim().isLength({ max: 80 }),
], handleValidation, async (req, res, next) => {
  try {
    const districts = await District.findAll({ attributes: ['id', 'name', 'riskLevel', 'lastAssessedAt'], order: [['name', 'ASC']] })
    const selected = req.query.districtId && districts.find((district) => district.id === req.query.districtId)
    if (req.query.districtId && !selected) return res.status(400).json({ error: 'Unknown district.' })
    const area = selected ? { district: selected.name } : {}
    const profileArea = selected ? { districtId: selected.id } : {}
    const currentDay = new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10)
    const weekEnd = new Date(`${currentDay}T00:00:00+06:00`)
    const weekStart = new Date(weekEnd.getTime() - 6 * 86400000)
    const dayExpression = fn('DATE', fn('CONVERT_TZ', col('received_at'), '+00:00', '+06:00'))
    const publicName = (receipt) => {
      const names = (receipt.donorName || '').trim().split(/\s+/).filter(Boolean)
      return receipt.isAnonymous || !names.length ? 'Anonymous' : names.length === 1 ? names[0] : `${names[0]} ${Array.from(names.at(-1))[0]}.`
    }
    const where = { ...area, status: req.query.status || { [Op.in]: ['Pending', 'Assigned'] } }
    if (req.query.q) where[Op.or] = ['name', 'district', 'upazila', 'needType', 'phone'].map((key) => ({ [key]: { [Op.like]: `%${req.query.q}%` } }))
    const score = literal("LEAST(people_count, 50) + CASE need_type WHEN 'Rescue' THEN 40 WHEN 'Medicine' THEN 30 WHEN 'Shelter' THEN 24 WHEN 'Clean water' THEN 20 WHEN 'Food' THEN 18 ELSE 10 END + CASE status WHEN 'Pending' THEN 15 ELSE 0 END")
    const page = req.query.page || 1
    const [donationTotal, donationDays, familyTotal, pending, assigned, volunteerCount, available, shelters, cases, ngos, profiles, activity, alerts, received] = await Promise.all([
      DonationReceipt.findOne({ attributes: [[fn('SUM', col('amount')), 'total']], where: { status: 'Received' }, raw: true }),
      DonationReceipt.findAll({ attributes: [[dayExpression, 'date'], [fn('SUM', col('amount')), 'amount'], [fn('COUNT', col('id')), 'count']], where: { status: 'Received', receivedAt: { [Op.gte]: weekStart } }, group: [dayExpression], order: [[dayExpression, 'ASC']], raw: true }),
      HelpRequest.sum('familiesHelped', { where: { ...area, status: 'Completed' } }),
      HelpRequest.count({ where: { ...area, status: 'Pending' } }),
      HelpRequest.count({ where: { ...area, status: 'Assigned' } }),
      VolunteerProfile.count({ where: { isActive: true }, include: [{ ...profileInclude, attributes: [], where: { role: 'volunteer', isActive: true, ...profileArea } }] }),
      VolunteerProfile.findAll({ attributes: ['userId', 'name', 'phone', 'location', 'skills', 'availability', 'verified', 'isActive'], where: { isActive: true, verified: true, availability: 'Available' }, include: [{ ...profileInclude, where: { role: 'volunteer', isActive: true, ...profileArea } }], order: [['name', 'ASC']] }),
      Shelter.findAll({ attributes: ['id', 'capacity', 'occupancy'], where: { isActive: true, ...(selected && { districtId: selected.id }) } }),
      HelpRequest.findAndCountAll({ where, attributes: { include: [[score, 'priorityScore']] }, include: [{ model: User, as: 'assignedTo', attributes: ['id', 'name'] }], order: [[score, 'DESC'], ['createdAt', 'ASC']], limit: 25, offset: (page - 1) * 25 }),
      req.user.role === 'admin' ? User.findAll({ where: { role: 'coordinator' }, attributes: ['id', 'name', 'email', 'districtId', 'isActive', 'approvalStatus', 'createdAt'], order: [['createdAt', 'DESC']] }) : [],
      VolunteerProfile.findAll({ attributes: ['userId', 'name', 'phone', 'location', 'skills', 'availability', 'verified', 'isActive', 'fieldReports'], include: [{ ...profileInclude, where: { role: 'volunteer', ...profileArea } }], order: [['name', 'ASC']], limit: 100 }),
      req.user.role === 'admin' ? AuditEntry.findAll({ include: [{ model: User, as: 'actor', attributes: ['name'] }], order: [['createdAt', 'DESC']], limit: 20 }) : [],
      Alert.findAll({ where: { [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] }, include: [{ model: District, as: 'district', attributes: ['name'] }], order: [['issuedAt', 'DESC']], limit: 10 }),
      DonationReceipt.findAll({ attributes: ['id', 'amount', 'donorName', 'isAnonymous', 'receivedAt'], where: { status: 'Received' }, order: [['receivedAt', 'DESC']], limit: 3 }),
    ])
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart.getTime() + index * 86400000 + 6 * 3600000).toISOString().slice(0, 10)
      const row = donationDays.find((item) => item.date === date)
      return { date, amount: Number(row?.amount || 0), count: Number(row?.count || 0) }
    })
    res.set('Cache-Control', 'no-store')
    res.json({
      updatedAt: new Date().toISOString(), districts,
      metrics: { donationsTaka: Number(donationTotal?.total || 0), familiesHelped: familyTotal || 0, pending, assigned, activeVolunteers: volunteerCount, availableVolunteers: available.length, reliefCampsOpen: shelters.length, nearingCapacity: shelters.filter((item) => item.capacity > 0 && item.occupancy / item.capacity >= 0.85).length },
      donationDays: days,
      recentDonations: received.map((receipt) => ({ id: receipt.id, displayName: publicName(receipt), amount: String(receipt.amount), receivedAt: receipt.receivedAt })),
      requests: cases.rows, requestCount: cases.count, page, pages: Math.ceil(cases.count / 25),
      ngos, profiles, availableVolunteers: available, activity, alerts,
    })
  } catch (error) { next(error) }
})

router.post('/ngos', requireRole('admin'), [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('districtId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
], handleValidation, async (req, res, next) => {
  try {
    if (req.body.districtId && !(await District.findByPk(req.body.districtId))) return res.status(400).json({ error: 'Unknown district.' })
    const user = await sequelize.transaction(async (transaction) => {
      const record = await User.create({ name: req.body.name, email: req.body.email, passwordHash: req.body.password, districtId: req.body.districtId || null, role: 'coordinator', isActive: true, approvalStatus: 'Pending' }, { transaction })
      await audit(req, 'NGO account created', `${record.name} is awaiting approval.`, transaction)
      return record
    })
    res.status(201).json({ user: user.toSafeJSON() })
  } catch (error) { next(error) }
})

router.patch('/ngos/:id', requireRole('admin'), [
  param('id').isInt({ min: 1 }).toInt(),
  body('approvalStatus').optional().isIn(['Pending', 'Approved']),
  body('isActive').optional().isBoolean().toBoolean(),
  body().custom((value) => value.approvalStatus !== undefined || value.isActive !== undefined),
], handleValidation, async (req, res, next) => {
  try {
    const user = await sequelize.transaction(async (transaction) => {
      const record = await User.findOne({ where: { id: req.params.id, role: 'coordinator' }, transaction, lock: transaction.LOCK?.UPDATE })
      if (!record) return null
      await record.update({ ...(req.body.approvalStatus !== undefined && { approvalStatus: req.body.approvalStatus }), ...(req.body.isActive !== undefined && { isActive: req.body.isActive }) }, { transaction })
      await audit(req, 'NGO account state updated', `${record.name}: ${record.isActive ? record.approvalStatus : 'Suspended'}.`, transaction)
      return record
    })
    if (!user) return res.status(404).json({ error: 'NGO account not found.' })
    res.json({ user: user.toSafeJSON() })
  } catch (error) { next(error) }
})

router.get('/volunteers/:userId', [param('userId').isInt({ min: 1 }).toInt()], handleValidation, async (req, res, next) => {
  try {
    const profile = await VolunteerProfile.findOne({ where: { userId: req.params.userId }, include: [profileInclude] })
    if (!profile) return res.status(404).json({ error: 'Volunteer profile not found.' })
    res.set('Cache-Control', 'no-store').json({ profile })
  } catch (error) { next(error) }
})

router.patch('/volunteers/:userId', [
  param('userId').isInt({ min: 1 }).toInt(),
  body('verified').optional().isBoolean().toBoolean(),
  body('isActive').optional().isBoolean().toBoolean(),
  body().custom((value) => value.verified !== undefined || value.isActive !== undefined),
], handleValidation, async (req, res, next) => {
  try {
    const profile = await sequelize.transaction(async (transaction) => {
      const record = await VolunteerProfile.findOne({ where: { userId: req.params.userId }, include: [profileInclude], transaction, lock: transaction.LOCK?.UPDATE })
      if (!record) return null
      await record.update({ ...(req.body.verified !== undefined && { verified: req.body.verified }), ...(req.body.isActive !== undefined && { isActive: req.body.isActive }) }, { transaction })
      if (req.body.isActive !== undefined) await record.user.update({ isActive: req.body.isActive }, { transaction })
      await audit(req, 'Volunteer state updated', `${record.name}: ${record.isActive ? record.verified ? 'Verified' : 'Awaiting verification' : 'Suspended'}.`, transaction)
      return record
    })
    if (!profile) return res.status(404).json({ error: 'Volunteer profile not found.' })
    res.json({ profile })
  } catch (error) { next(error) }
})
export default router
