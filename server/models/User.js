/* eslint-env node */
import bcrypt from 'bcryptjs'
import { DataTypes, Model } from 'sequelize'

export const USER_ROLES = ['admin', 'coordinator', 'volunteer', 'citizen']

export class User extends Model {
  async verifyPassword(plain) {
    if (!this.passwordHash) return false
    return bcrypt.compare(plain, this.passwordHash)
  }

  toSafeJSON() {
    const { id, name, email, phone, role, districtId, createdAt } = this
    return { id, name, email, phone, role, districtId, createdAt }
  }
}

export function initUser(sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...USER_ROLES),
        allowNull: false,
        defaultValue: 'citizen',
      },
      districtId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      indexes: [{ fields: ['role'] }, { fields: ['district_id'] }],
    },
  )

  User.beforeSave(async (user) => {
    if (user.changed('passwordHash') && user.passwordHash && !user.passwordHash.startsWith('$2')) {
      user.passwordHash = await bcrypt.hash(user.passwordHash, 10)
    }
  })

  return User
}
