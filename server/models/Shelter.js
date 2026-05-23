/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export class Shelter extends Model {}

export function initShelter(sequelize) {
  Shelter.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      capacity: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      occupancy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
      },
      districtId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'Shelter',
      tableName: 'shelters',
      indexes: [{ fields: ['district_id'] }],
    },
  )

  return Shelter
}
