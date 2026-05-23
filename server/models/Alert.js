/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export const ALERT_SEVERITIES = ['Low', 'Medium', 'High', 'Critical']

export class Alert extends Model {}

export function initAlert(sequelize) {
  Alert.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      severity: {
        type: DataTypes.ENUM(...ALERT_SEVERITIES),
        allowNull: false,
        defaultValue: 'Medium',
      },
      districtId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      issuedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Alert',
      tableName: 'alerts',
      indexes: [{ fields: ['severity'] }, { fields: ['issued_at'] }, { fields: ['district_id'] }],
    },
  )

  return Alert
}
