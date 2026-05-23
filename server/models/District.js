/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical']

export class District extends Model {}

export function initDistrict(sequelize) {
  District.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      division: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      riskLevel: {
        type: DataTypes.ENUM(...RISK_LEVELS),
        allowNull: false,
        defaultValue: 'Low',
      },
      riverWaterLevel: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
      },
      lastAssessedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'District',
      tableName: 'districts',
    },
  )

  return District
}
