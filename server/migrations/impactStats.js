import { DataTypes } from 'sequelize'
import { DonationReceipt, HelpRequest, sequelize } from '../models/index.js'

// Targeted, idempotent migration. Existing cases are not assumed to have helped a family.
export async function migrateImpactStats() {
  await DonationReceipt.sync()
  await HelpRequest.sync()
  const queryInterface = sequelize.getQueryInterface()
  const receiptColumns = await queryInterface.describeTable('donation_receipts')
  if (!receiptColumns.is_anonymous) {
    await queryInterface.addColumn('donation_receipts', 'is_anonymous', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    })
  }
  const columns = await queryInterface.describeTable('help_requests')
  if (!columns.families_helped) {
    await queryInterface.addColumn('help_requests', 'families_helped', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    })
  }
}
