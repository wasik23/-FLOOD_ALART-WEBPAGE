/* eslint-env node */
import { Sequelize } from 'sequelize'

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_NAME = 'reliefops',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_LOGGING = 'false',
} = process.env

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'mysql',
  logging: DB_LOGGING === 'true' ? console.log : false,
  define: {
    underscored: true,
    freezeTableName: false,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
})

export async function connectDatabase() {
  await sequelize.authenticate()
  return sequelize
}
