/* eslint-env node */
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
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

import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

const PORT = process.env.PORT || 3000
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN
const DB_SYNC = process.env.DB_SYNC || 'safe' // 'safe' | 'alter' | 'force' | 'off'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN ? CLIENT_ORIGIN.split(',') : true,
    methods: ['GET', 'POST'],
  },
})
app.set('io', io)

app.use(cors({ origin: CLIENT_ORIGIN ? CLIENT_ORIGIN.split(',') : true }))
app.use(express.json({ limit: '128kb' }))

const now = () => new Date().toISOString()

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    db: Object.hasOwn(sequelize.connectionManager, 'pool') ? 'ready' : 'pending',
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

// Internal event endpoints used by the simulator / external producers.
app.post('/events/alerts', (req, res) => {
  const event = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now(),
    ...req.body,
  }
  io.emit('new_alert', event)
  res.status(201).json(event)
})

app.post('/events/water-level', (req, res) => {
  const event = {
    id: `water-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now(),
    ...req.body,
  }
  io.emit('water_level_update', event)
  res.status(201).json(event)
})

app.post('/events/tasks/accepted', (req, res) => {
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
    await connectDatabase()
    await syncDatabase()
    console.log(`[db] connected (sync=${DB_SYNC})`)
  } catch (err) {
    console.error('[db] connection failed:', err.message)
    if (process.env.DB_REQUIRED === 'true') process.exit(1)
    console.warn('[db] continuing without database — REST endpoints that need it will 500.')
  }

  httpServer.listen(PORT, () => {
    console.log(`ReliefOps backend listening on http://localhost:${PORT}`)
  })
}

bootstrap()
