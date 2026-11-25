import { Router } from 'express'
import { col, fn } from 'sequelize'
import { DonationReceipt, HelpRequest, Shelter, User, VolunteerProfile } from '../models/index.js'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const [donations, familiesHelped, activeVolunteers, reliefCampsOpen] = await Promise.all([
      DonationReceipt.findOne({
        attributes: [[fn('SUM', col('amount')), 'total']],
        where: { status: 'Received' },
        raw: true,
      }),
      HelpRequest.sum('familiesHelped', { where: { status: 'Completed' } }),
      VolunteerProfile.count({
        where: { isActive: true },
        include: [{ model: User, as: 'user', required: true, where: { role: 'volunteer' } }],
      }),
      Shelter.count({ where: { isActive: true } }),
    ])
    res.set('Cache-Control', 'no-store')
    res.json({
      donationsTaka: String(donations?.total ?? '0.00'),
      familiesHelped: familiesHelped ?? 0,
      activeVolunteers,
      reliefCampsOpen,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

export default router
