import { DataTypes, Model } from 'sequelize'

export const DONATION_CHANNELS = ['Cash', 'bKash', 'Nagad', 'Bank transfer', 'Other']
export const DONATION_STATUSES = ['Received', 'Refunded']

export class DonationReceipt extends Model {}

export function initDonationReceipt(sequelize) {
  DonationReceipt.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      validate: { min: 0.01, max: 999999999999.99 },
    },
    reference: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    donorName: { type: DataTypes.STRING(120), allowNull: true },
    isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    channel: { type: DataTypes.ENUM(...DONATION_CHANNELS), allowNull: false },
    status: { type: DataTypes.ENUM(...DONATION_STATUSES), allowNull: false, defaultValue: 'Received' },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    notes: { type: DataTypes.STRING(500), allowNull: true },
    recordedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    updatedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  }, {
    sequelize,
    modelName: 'DonationReceipt',
    tableName: 'donation_receipts',
    indexes: [{ fields: ['status', 'received_at'] }],
  })
  return DonationReceipt
}
