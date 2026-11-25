/* eslint-env node */
import 'dotenv/config'
import { connectDatabase, sequelize } from '../config/database.js'
import {
  Alert,
  District,
  DonationAccount,
  DonationReceipt,
  HelpRequest,
  Shelter,
  Subscriber,
  Task,
  User,
  VolunteerProfile,
  WaterLevelReport,
} from '../models/index.js'

const resources = {
  alerts: Alert,
  districts: District,
  donations: DonationAccount,
  'donation-receipts': DonationReceipt,
  'help-requests': HelpRequest,
  shelters: Shelter,
  subscribers: Subscriber,
  tasks: Task,
  users: User,
  volunteers: VolunteerProfile,
  'water-levels': WaterLevelReport,
}

const resource = process.argv[2]
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1]) || 20, 1), 200)

if (!resources[resource]) {
  console.error(`Usage: npm run db:query -- <${Object.keys(resources).join('|')}> [--limit=20]`)
  process.exit(1)
}

try {
  await connectDatabase()
  const rows = await resources[resource].findAll({ order: [['createdAt', 'DESC']], limit, raw: true })
  console.table(rows)
  console.log(`[query] ${rows.length} ${resource} row(s)`)
} catch (error) {
  console.error('[query] failed:', error.message)
  process.exitCode = 1
} finally {
  await sequelize.close()
}
