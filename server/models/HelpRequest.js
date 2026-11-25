/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export const HELP_REQUEST_STATUSES = ['Pending', 'Assigned', 'Completed', 'Cancelled']
export const HELP_NEED_TYPES = ['Rescue', 'Food', 'Medicine', 'Shelter', 'Clean water', 'Other']

export class HelpRequest extends Model {}

export function initHelpRequest(sequelize) {
  HelpRequest.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(120), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      district: { type: DataTypes.STRING(80), allowNull: false },
      upazila: { type: DataTypes.STRING(120), allowNull: false },
      address: { type: DataTypes.STRING(500), allowNull: false },
      needType: { type: DataTypes.ENUM(...HELP_NEED_TYPES), allowNull: false },
      peopleCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      familiesHelped: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      notes: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM(...HELP_REQUEST_STATUSES),
        allowNull: false,
        defaultValue: 'Pending',
      },
      assignedToId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    {
      sequelize,
      modelName: 'HelpRequest',
      tableName: 'help_requests',
      indexes: [
        { fields: ['status', 'created_at'] },
        { fields: ['district', 'upazila'] },
        { fields: ['phone'] },
      ],
    },
  )
  return HelpRequest
}
