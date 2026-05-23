/* eslint-env node */
import 'dotenv/config'
import { connectDatabase, sequelize } from '../config/database.js'
import { District, User } from '../models/index.js'

const SEED_DISTRICTS = [
  { name: 'Sylhet', division: 'Sylhet', riskLevel: 'Critical', riverWaterLevel: 8.12 },
  { name: 'Jamalpur', division: 'Mymensingh', riskLevel: 'High', riverWaterLevel: 6.41 },
  { name: 'Kurigram', division: 'Rangpur', riskLevel: 'High', riverWaterLevel: 5.9 },
  { name: 'Gaibandha', division: 'Rangpur', riskLevel: 'Medium', riverWaterLevel: 4.3 },
  { name: 'Bogura', division: 'Rajshahi', riskLevel: 'Medium', riverWaterLevel: 3.8 },
  { name: 'Dhaka', division: 'Dhaka', riskLevel: 'Low', riverWaterLevel: 2.4 },
  { name: 'Rangpur', division: 'Rangpur', riskLevel: 'Medium', riverWaterLevel: 4.0 },
  { name: 'Tangail', division: 'Dhaka', riskLevel: 'Low', riverWaterLevel: 2.1 },
]

const SEED_ADMIN = {
  name: 'ReliefOps Admin',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@reliefops.local',
  password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!2026',
  role: 'admin',
}

async function run() {
  await connectDatabase()
  await sequelize.sync({ alter: true })

  for (const d of SEED_DISTRICTS) {
    await District.findOrCreate({
      where: { name: d.name },
      defaults: { ...d, lastAssessedAt: new Date() },
    })
  }
  console.log(`[seed] ensured ${SEED_DISTRICTS.length} districts`)

  const [admin, created] = await User.findOrCreate({
    where: { email: SEED_ADMIN.email },
    defaults: {
      name: SEED_ADMIN.name,
      email: SEED_ADMIN.email,
      passwordHash: SEED_ADMIN.password,
      role: SEED_ADMIN.role,
    },
  })
  console.log(
    created
      ? `[seed] created admin ${admin.email} (password: ${SEED_ADMIN.password})`
      : `[seed] admin ${admin.email} already exists`,
  )

  await sequelize.close()
}

run().catch((err) => {
  console.error('[seed] failed:', err)
  process.exit(1)
})
