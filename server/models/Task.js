/* eslint-env node */
import { DataTypes, Model } from 'sequelize'

export const TASK_STATUSES = ['Open', 'Accepted', 'InProgress', 'Completed', 'Cancelled']
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

export class Task extends Model {}

export function initTask(sequelize) {
  Task.init(
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
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      priority: {
        type: DataTypes.ENUM(...TASK_PRIORITIES),
        allowNull: false,
        defaultValue: 'Medium',
      },
      status: {
        type: DataTypes.ENUM(...TASK_STATUSES),
        allowNull: false,
        defaultValue: 'Open',
      },
      districtId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      assignedToId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      acceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Task',
      tableName: 'tasks',
      indexes: [
        { fields: ['status'] },
        { fields: ['district_id'] },
        { fields: ['assigned_to_id'] },
      ],
    },
  )

  return Task
}
