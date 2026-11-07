/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export class DonationAccount extends Model {}

export function initDonationAccount(sequelize) {
  DonationAccount.init(
    {
      id: { type: DataTypes.STRING(80), primaryKey: true },
      type: { type: DataTypes.STRING(80), allowNull: false },
      label: { type: DataTypes.STRING(100), allowNull: false },
      accountName: { type: DataTypes.STRING(160), allowNull: false },
      accountNumber: { type: DataTypes.STRING(100), allowNull: false },
      branch: { type: DataTypes.STRING(160), allowNull: true },
      instructions: { type: DataTypes.STRING(500), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      updatedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    {
      sequelize,
      modelName: 'DonationAccount',
      tableName: 'donation_accounts',
      indexes: [{ fields: ['is_active', 'type'] }],
    },
  )
  return DonationAccount
}
