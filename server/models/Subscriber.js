/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export class Subscriber extends Model {}

export function initSubscriber(sequelize) {
  Subscriber.init(
    {
      phone: { type: DataTypes.STRING(20), primaryKey: true },
      district: { type: DataTypes.STRING(80), allowNull: false },
      upazila: { type: DataTypes.STRING(120), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      consentedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      unsubscribedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Subscriber',
      tableName: 'subscribers',
      indexes: [
        { fields: ['district', 'upazila'] },
        { fields: ['is_active'] },
      ],
    },
  )
  return Subscriber
}
