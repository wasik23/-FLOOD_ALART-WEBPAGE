/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export const VOLUNTEER_AVAILABILITY = ['Available', 'Busy', 'Offline']

export class VolunteerProfile extends Model {}

export function initVolunteerProfile(sequelize) {
  VolunteerProfile.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, unique: true },
      externalUserId: { type: DataTypes.STRING(100), allowNull: true, unique: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(160), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: true },
      address: { type: DataTypes.STRING(500), allowNull: true },
      guardianPhone: { type: DataTypes.STRING(20), allowNull: true },
      location: { type: DataTypes.STRING(160), allowNull: true },
      skills: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      availability: {
        type: DataTypes.ENUM(...VOLUNTEER_AVAILABILITY),
        allowNull: false,
        defaultValue: 'Available',
      },
      imageData: { type: DataTypes.TEXT('long'), allowNull: true },
      fieldReports: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'VolunteerProfile',
      tableName: 'volunteer_profiles',
      indexes: [
        { fields: ['availability', 'is_active'] },
        { fields: ['email'] },
        { fields: ['location'] },
      ],
    },
  )
  return VolunteerProfile
}
