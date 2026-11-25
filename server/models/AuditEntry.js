import { DataTypes, Model } from 'sequelize'

export class AuditEntry extends Model {}
export function initAuditEntry(sequelize) {
  AuditEntry.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    actorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    action: { type: DataTypes.STRING(80), allowNull: false },
    detail: { type: DataTypes.STRING(500), allowNull: false },
  }, { sequelize, modelName: 'AuditEntry', tableName: 'audit_entries' })
  return AuditEntry
}
