/* eslint-env node */
import { sequelize } from '../config/database.js'
import { initUser, USER_ROLES } from './User.js'
import { initDistrict, RISK_LEVELS } from './District.js'
import { initShelter } from './Shelter.js'
import { initTask, TASK_STATUSES, TASK_PRIORITIES } from './Task.js'
import { initWaterLevelReport } from './WaterLevelReport.js'
import { initAlert, ALERT_SEVERITIES } from './Alert.js'
import { initSubscriber } from './Subscriber.js'
import { initHelpRequest, HELP_REQUEST_STATUSES, HELP_NEED_TYPES } from './HelpRequest.js'
import { initVolunteerProfile, VOLUNTEER_AVAILABILITY } from './VolunteerProfile.js'
import { initDonationAccount } from './DonationAccount.js'

const User = initUser(sequelize)
const District = initDistrict(sequelize)
const Shelter = initShelter(sequelize)
const Task = initTask(sequelize)
const WaterLevelReport = initWaterLevelReport(sequelize)
const Alert = initAlert(sequelize)
const Subscriber = initSubscriber(sequelize)
const HelpRequest = initHelpRequest(sequelize)
const VolunteerProfile = initVolunteerProfile(sequelize)
const DonationAccount = initDonationAccount(sequelize)

District.hasMany(User, { foreignKey: 'districtId', as: 'users' })
User.belongsTo(District, { foreignKey: 'districtId', as: 'district' })

District.hasMany(Shelter, { foreignKey: 'districtId', as: 'shelters' })
Shelter.belongsTo(District, { foreignKey: 'districtId', as: 'district' })
User.hasMany(Shelter, { foreignKey: 'createdById', as: 'createdShelters' })
Shelter.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' })

District.hasMany(Task, { foreignKey: 'districtId', as: 'tasks' })
Task.belongsTo(District, { foreignKey: 'districtId', as: 'district' })
User.hasMany(Task, { foreignKey: 'createdById', as: 'createdTasks' })
Task.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' })
User.hasMany(Task, { foreignKey: 'assignedToId', as: 'acceptedTasks' })
Task.belongsTo(User, { foreignKey: 'assignedToId', as: 'assignedTo' })

District.hasMany(WaterLevelReport, { foreignKey: 'districtId', as: 'waterLevelReports' })
WaterLevelReport.belongsTo(District, { foreignKey: 'districtId', as: 'district' })
User.hasMany(WaterLevelReport, { foreignKey: 'reportedById', as: 'waterReports' })
WaterLevelReport.belongsTo(User, { foreignKey: 'reportedById', as: 'reportedBy' })

District.hasMany(Alert, { foreignKey: 'districtId', as: 'alerts' })
Alert.belongsTo(District, { foreignKey: 'districtId', as: 'district' })
User.hasMany(Alert, { foreignKey: 'issuedById', as: 'issuedAlerts' })
Alert.belongsTo(User, { foreignKey: 'issuedById', as: 'issuedBy' })

User.hasOne(VolunteerProfile, { foreignKey: 'userId', as: 'volunteerProfile' })
VolunteerProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' })
User.hasMany(HelpRequest, { foreignKey: 'assignedToId', as: 'assignedHelpRequests' })
HelpRequest.belongsTo(User, { foreignKey: 'assignedToId', as: 'assignedTo' })
User.hasMany(DonationAccount, { foreignKey: 'updatedById', as: 'updatedDonationAccounts' })
DonationAccount.belongsTo(User, { foreignKey: 'updatedById', as: 'updatedBy' })

export {
  sequelize,
  User,
  District,
  Shelter,
  Task,
  WaterLevelReport,
  Alert,
  Subscriber,
  HelpRequest,
  VolunteerProfile,
  DonationAccount,
  USER_ROLES,
  RISK_LEVELS,
  TASK_STATUSES,
  TASK_PRIORITIES,
  ALERT_SEVERITIES,
  HELP_REQUEST_STATUSES,
  HELP_NEED_TYPES,
  VOLUNTEER_AVAILABILITY,
}
