import 'dotenv/config'
import { connectDatabase, sequelize } from '../config/database.js'
import { migrateDashboard } from '../migrations/dashboard.js'
try {
  await connectDatabase()
  await migrateDashboard()
  console.log('[db] account approval, suspension and dashboard audit storage are ready')
} catch (error) {
  console.error('[db] dashboard migration failed:', error.message)
  process.exitCode = 1
} finally { await sequelize.close() }
