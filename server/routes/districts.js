/* eslint-env node */
import { Router } from 'express'
import { District } from '../models/index.js'

const router = Router()

// GET /api/districts — public; returns districts with current risk levels.
router.get('/', async (req, res, next) => {
  try {
    const districts = await District.findAll({
      order: [['name', 'ASC']],
      attributes: [
        'id',
        'name',
        'division',
        'riskLevel',
        'riverWaterLevel',
        'lastAssessedAt',
      ],
    })
    res.json({ count: districts.length, districts })
  } catch (err) {
    next(err)
  }
})

export default router
