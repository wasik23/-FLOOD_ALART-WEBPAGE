/* eslint-env node */
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

import { connectDatabase, sequelize } from './config/database.js'
import './models/index.js'

import alertsRouter from './routes/alerts.js'
import authRouter from './routes/auth.js'
import districtsRouter from './routes/districts.js'
import ffwcRouter from './routes/ffwc.js'
import sheltersRouter from './routes/shelters.js'
import tasksRouter from './routes/tasks.js'
import reportsRouter from './routes/reports.js'
import helpRequestsRouter from './routes/helpRequests.js'
import volunteersRouter from './routes/volunteers.js'
import donationsRouter from './routes/donations.js'
import databaseViewerRouter from './routes/databaseViewer.js'

import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'
import {
  listCurrentWaterAlerts,
  recordWaterLevelAndAlert,
} from './services/waterLevelAlerts.js'
import { migrateLegacySubscribers } from './services/subscriberStore.js'

const PORT = process.env.PORT || 3000
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN
const DB_SYNC = process.env.DB_SYNC || 'safe' // 'safe' | 'alter' | 'force' | 'off'
const isProduction = process.env.NODE_ENV === 'production'
let databaseReady = false

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN ? CLIENT_ORIGIN.split(',') : true,
    methods: ['GET', 'POST'],
  },
})
app.set('io', io)

app.use(helmet())
app.use(cors({ origin: CLIENT_ORIGIN ? CLIENT_ORIGIN.split(',') : !isProduction }))
app.use(express.json({ limit: '128kb' }))
const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})
app.use('/auth', authLimiter)
app.use('/api/alerts/subscribe', publicWriteLimiter)
app.use('/api/help-requests', publicWriteLimiter)

const now = () => new Date().toISOString()

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    db: databaseReady ? 'ready' : 'unavailable',
    socketClients: io.engine.clientsCount,
    time: now(),
  })
})

// Mount REST API
app.use('/auth', authRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/districts', districtsRouter)
app.use('/api/ffwc', ffwcRouter)
app.use('/api/shelters', sheltersRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/help-requests', helpRequestsRouter)
app.use('/api/volunteers', volunteersRouter)
app.use('/api/donations', donationsRouter)
if (process.env.ENABLE_DB_VIEWER === 'true' && !isProduction) {
  app.use('/db-viewer', databaseViewerRouter)
}

// Internal event endpoints used by the simulator / external producers.
app.post('/events/alerts', (req, res) => {
  if (!eventTokenIsValid(req)) {
    return res.status(401).json({ error: 'Invalid event token.' })
  }
  const event = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now(),
    ...req.body,
  }
  io.emit('new_alert', event)
  res.status(201).json(event)
})

app.get('/events/water-level/current', (_req, res) => {
  const alerts = listCurrentWaterAlerts()
  res.json({ count: alerts.length, alerts })
})

function eventTokenIsValid(req) {
  if (!process.env.WATER_LEVEL_EVENT_TOKEN) return true

  const authHeader = req.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const headerToken = req.get('x-event-token')
  return (
    bearerToken === process.env.WATER_LEVEL_EVENT_TOKEN ||
    headerToken === process.env.WATER_LEVEL_EVENT_TOKEN
  )
}

app.post('/events/water-level', async (req, res, next) => {
  try {
    if (!eventTokenIsValid(req)) {
      return res.status(401).json({ error: 'Invalid water-level event token.' })
    }

    const {
      districtId,
      district,
      level,
      unit,
      riskLevel,
      note,
      latitude,
      longitude,
      observedAt,
      upazila,
    } = req.body ?? {}
    const numericLevel = Number(level)

    if (!Number.isFinite(numericLevel) || numericLevel < 0 || numericLevel > 50) {
      return res.status(400).json({ error: 'level must be a number between 0 and 50.' })
    }

    if (unit && !['m', 'ft'].includes(unit)) {
      return res.status(400).json({ error: 'unit must be m or ft.' })
    }

    if (riskLevel && !['Low', 'Medium', 'High', 'Critical'].includes(riskLevel)) {
      return res.status(400).json({
        error: 'riskLevel must be Low, Medium, High, or Critical.',
      })
    }

    if (observedAt && Number.isNaN(new Date(observedAt).getTime())) {
      return res.status(400).json({ error: 'observedAt must be a valid date.' })
    }

    const result = await recordWaterLevelAndAlert({
      app,
      districtId,
      district,
      level: numericLevel,
      unit: unit || 'm',
      riskLevel,
      note,
      latitude,
      longitude,
      observedAt,
      upazila,
      issuedById: null,
      databaseOptional: true,
    })

    return res.status(201).json({
      ok: true,
      ...result,
    })
  } catch (error) {
    return next(error)
  }
})

app.post('/events/tasks/accepted', (req, res) => {
  if (!eventTokenIsValid(req)) {
    return res.status(401).json({ error: 'Invalid event token.' })
  }
  const event = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now(),
    status: 'Accepted',
    ...req.body,
  }
  io.emit('volunteer_accepted_task', event)
  res.status(201).json(event)
})

io.on('connection', (socket) => {
  socket.emit('new_alert', {
    id: 'alert-welcome',
    district: 'Bangladesh',
    message: 'Realtime relief operations feed connected.',
    severity: 'Low',
    timestamp: now(),
    title: 'Socket connected',
  })
})

app.use(notFoundHandler)
app.use(errorHandler)

async function syncDatabase() {
  if (DB_SYNC === 'off') return
  const options =
    DB_SYNC === 'force' ? { force: true } : DB_SYNC === 'alter' ? { alter: true } : {}
  await sequelize.sync(options)
}

async function bootstrap() {
  try {
    if (isProduction) {
      const unsafeSecret = !process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production'
      if (unsafeSecret) throw new Error('JWT_SECRET must be set to a strong value in production.')
      if (!CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN must be set in production.')
      if (!process.env.WATER_LEVEL_EVENT_TOKEN) {
        throw new Error('WATER_LEVEL_EVENT_TOKEN must be set in production.')
      }
    }
    await connectDatabase()
    await syncDatabase()
    databaseReady = true
    const migratedSubscribers = await migrateLegacySubscribers()
    console.log(`[db] connected (sync=${DB_SYNC})`)
    if (migratedSubscribers) {
      console.log(`[db] ensured ${migratedSubscribers} legacy SMS subscribers`)
    }
  } catch (err) {
    databaseReady = false
    console.error('[db] connection failed:', err.message)
    if (isProduction || process.env.DB_REQUIRED === 'true') process.exit(1)
    console.warn('[db] continuing without database — REST endpoints that need it will 500.')
  }

  httpServer.listen(PORT, () => {
    console.log(`ReliefOps backend listening on http://localhost:${PORT}`)
  })
}

bootstrap()
