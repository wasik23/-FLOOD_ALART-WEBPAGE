import { DataTypes } from 'sequelize'
import { User, AuditEntry, sequelize } from '../models/index.js'

export async function migrateDashboard() {
  await User.sync()
  const query = sequelize.getQueryInterface()
  const columns = await query.describeTable('users')
  if (!columns.is_active) await query.addColumn('users', 'is_active', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true })
  if (!columns.approval_status) await query.addColumn('users', 'approval_status', { type: DataTypes.ENUM('Pending', 'Approved'), allowNull: false, defaultValue: 'Approved' })
  await AuditEntry.sync()
}
