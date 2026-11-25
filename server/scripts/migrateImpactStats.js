import 'dotenv/config'
import { connectDatabase, sequelize } from '../config/database.js'
import { migrateImpactStats } from '../migrations/impactStats.js'

try {
  await connectDatabase()
  await migrateImpactStats()
  console.log('[db] donation ledger, public-feed privacy and families-helped tracking are ready')
} catch (error) {
  console.error('[db] impact migration failed:', error.message)
  process.exitCode = 1
} finally {
  await sequelize.close()
}
