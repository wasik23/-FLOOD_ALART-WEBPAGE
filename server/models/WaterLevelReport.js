/* eslint-env node */
import { DataTypes, Model } from 'sequelize'
import { RISK_LEVELS } from './District.js'

export class WaterLevelReport extends Model {}

export function initWaterLevelReport(sequelize) {
  WaterLevelReport.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      districtId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      reportedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      level: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
      },
      unit: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'm',
      },
      riskLevel: {
        type: DataTypes.ENUM(...RISK_LEVELS),
        allowNull: false,
        defaultValue: 'Low',
      },
      note: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
      },
      observedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'WaterLevelReport',
      tableName: 'water_level_reports',
      indexes: [{ fields: ['district_id'] }, { fields: ['observed_at'] }],
    },
  )

  return WaterLevelReport
}
