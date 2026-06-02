/* eslint-env node */
import 'dotenv/config'
import { connectDatabase, sequelize } from '../config/database.js'
import {
  Alert,
  District,
  Shelter,
  Task,
  User,
  WaterLevelReport,
} from '../models/index.js'
import { upsertSubscriber } from '../services/subscriberStore.js'

const SEED_DISTRICTS = [
  { name: 'Sylhet', division: 'Sylhet', riskLevel: 'Critical', riverWaterLevel: 8.12 },
  { name: 'Jamalpur', division: 'Mymensingh', riskLevel: 'High', riverWaterLevel: 6.41 },
  { name: 'Kurigram', division: 'Rangpur', riskLevel: 'High', riverWaterLevel: 5.9 },
  { name: 'Gaibandha', division: 'Rangpur', riskLevel: 'Medium', riverWaterLevel: 4.3 },
  { name: 'Bogura', division: 'Rajshahi', riskLevel: 'Medium', riverWaterLevel: 3.8 },
  { name: 'Dhaka', division: 'Dhaka', riskLevel: 'Low', riverWaterLevel: 2.4 },
  { name: 'Rangpur', division: 'Rangpur', riskLevel: 'Medium', riverWaterLevel: 4.0 },
  { name: 'Tangail', division: 'Dhaka', riskLevel: 'Low', riverWaterLevel: 2.1 },
]

const SEED_ADMIN = {
  name: 'ReliefOps Admin',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@reliefops.local',
  password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!2026',
  role: 'admin',
}

const SEED_USERS = [
  {
    name: 'Farhana Akter',
    email: 'farhana.coordinator@reliefops.local',
    password: 'MockPass!2026',
    phone: '8801711001001',
    role: 'coordinator',
    district: 'Sylhet',
  },
  {
    name: 'Rahim Uddin',
    email: 'rahim.volunteer@reliefops.local',
    password: 'MockPass!2026',
    phone: '8801811001002',
    role: 'volunteer',
    district: 'Jamalpur',
  },
  {
    name: 'Nusrat Jahan',
    email: 'nusrat.volunteer@reliefops.local',
    password: 'MockPass!2026',
    phone: '8801911001003',
    role: 'volunteer',
    district: 'Kurigram',
  },
  {
    name: 'Masud Rana',
    email: 'masud.coordinator@reliefops.local',
    password: 'MockPass!2026',
    phone: '8801611001004',
    role: 'coordinator',
    district: 'Gaibandha',
  },
  {
    name: 'Shila Begum',
    email: 'shila.citizen@reliefops.local',
    password: 'MockPass!2026',
    phone: '8801511001005',
    role: 'citizen',
    district: 'Bogura',
  },
  {
    name: 'Arif Hossain',
    email: 'arif.volunteer@reliefops.local',
    password: 'MockPass!2026',
    phone: '8801311001006',
    role: 'volunteer',
    district: 'Dhaka',
  },
]

const SEED_SHELTERS = [
  {
    name: 'Sylhet Govt. Pilot High School Shelter',
    district: 'Sylhet',
    address: 'Zindabazar, Sylhet Sadar',
    capacity: 520,
    occupancy: 438,
    latitude: 24.89493,
    longitude: 91.86871,
  },
  {
    name: 'Jamalpur Polytechnic Relief Center',
    district: 'Jamalpur',
    address: 'Melandaha Road, Jamalpur',
    capacity: 340,
    occupancy: 276,
    latitude: 24.93753,
    longitude: 90.00032,
  },
  {
    name: 'Kurigram College Cyclone Shelter',
    district: 'Kurigram',
    address: 'College Para, Kurigram',
    capacity: 410,
    occupancy: 319,
    latitude: 25.80545,
    longitude: 89.63618,
  },
  {
    name: 'Gaibandha Union Parishad Shelter',
    district: 'Gaibandha',
    address: 'Sadar Upazila Complex, Gaibandha',
    capacity: 260,
    occupancy: 143,
    latitude: 25.3293,
    longitude: 89.5438,
  },
  {
    name: 'Bogura Community Hall',
    district: 'Bogura',
    address: 'Sherpur Road, Bogura',
    capacity: 180,
    occupancy: 62,
    latitude: 24.84652,
    longitude: 89.37772,
  },
  {
    name: 'Tangail Model School Shelter',
    district: 'Tangail',
    address: 'Nirala Mor, Tangail',
    capacity: 220,
    occupancy: 35,
    latitude: 24.25135,
    longitude: 89.91669,
  },
]

const SEED_TASKS = [
  {
    title: 'Move dry food packs to Shahjalal Upashahar',
    description: 'Deliver 300 family packs and confirm receipt with ward volunteers.',
    district: 'Sylhet',
    priority: 'Critical',
    status: 'InProgress',
    assignedTo: 'rahim.volunteer@reliefops.local',
  },
  {
    title: 'Set up water purification station near Surma riverbank',
    description: 'Install filters, chlorine tablets, and a queue marker for safe drinking water.',
    district: 'Sylhet',
    priority: 'High',
    status: 'Open',
  },
  {
    title: 'Rescue request verification in Islampur char area',
    description: 'Call listed households and mark confirmed evacuation needs.',
    district: 'Jamalpur',
    priority: 'High',
    status: 'Accepted',
    assignedTo: 'rahim.volunteer@reliefops.local',
  },
  {
    title: 'Distribute oral saline at Kurigram College Shelter',
    description: 'Prioritize children, pregnant people, and elderly residents.',
    district: 'Kurigram',
    priority: 'Medium',
    status: 'Completed',
    assignedTo: 'nusrat.volunteer@reliefops.local',
  },
  {
    title: 'Inspect latrine facilities at Gaibandha shelter',
    description: 'Report cleaning supplies, lighting, and repair needs before evening.',
    district: 'Gaibandha',
    priority: 'Medium',
    status: 'Open',
  },
  {
    title: 'Prepare standby transport list for Tangail',
    description: 'Collect available truck, boat, and driver contact details.',
    district: 'Tangail',
    priority: 'Low',
    status: 'Open',
  },
]

const SEED_REPORTS = [
  {
    district: 'Sylhet',
    reporter: 'farhana.coordinator@reliefops.local',
    level: 8.35,
    riskLevel: 'Critical',
    note: 'Surma river remains above danger mark; several low-lying roads submerged.',
    latitude: 24.89912,
    longitude: 91.8714,
    daysAgo: 0,
  },
  {
    district: 'Jamalpur',
    reporter: 'rahim.volunteer@reliefops.local',
    level: 6.58,
    riskLevel: 'High',
    note: 'Water rising near Islampur ferry ghat.',
    latitude: 25.08121,
    longitude: 89.78923,
    daysAgo: 1,
  },
  {
    district: 'Kurigram',
    reporter: 'nusrat.volunteer@reliefops.local',
    level: 5.94,
    riskLevel: 'High',
    note: 'Embankment seepage reported by local volunteers.',
    latitude: 25.81223,
    longitude: 89.64831,
    daysAgo: 1,
  },
  {
    district: 'Gaibandha',
    reporter: 'masud.coordinator@reliefops.local',
    level: 4.42,
    riskLevel: 'Medium',
    note: 'Shelter occupancy increasing after afternoon rainfall.',
    latitude: 25.32889,
    longitude: 89.54191,
    daysAgo: 2,
  },
  {
    district: 'Bogura',
    reporter: 'arif.volunteer@reliefops.local',
    level: 3.72,
    riskLevel: 'Medium',
    note: 'No new road closures; monitoring continues.',
    latitude: 24.84711,
    longitude: 89.37244,
    daysAgo: 3,
  },
]

const SEED_ALERTS = [
  {
    title: 'Critical flooding warning for Sylhet Sadar',
    message: 'Avoid riverbank roads and move vulnerable households to listed shelters.',
    severity: 'Critical',
    district: 'Sylhet',
    hoursAgo: 2,
    expiresInHours: 22,
  },
  {
    title: 'High water level near Jamalpur chars',
    message: 'Boat teams should remain on standby for evacuation calls.',
    severity: 'High',
    district: 'Jamalpur',
    hoursAgo: 6,
    expiresInHours: 18,
  },
  {
    title: 'Medical support needed at Kurigram shelter',
    message: 'Send oral saline, fever medicine, and basic triage supplies.',
    severity: 'Medium',
    district: 'Kurigram',
    hoursAgo: 12,
    expiresInHours: 24,
  },
  {
    title: 'All-district rainfall advisory',
    message: 'Heavy rain may affect travel times for supply and rescue teams.',
    severity: 'Medium',
    district: null,
    hoursAgo: 18,
    expiresInHours: 30,
  },
]

const SEED_SUBSCRIBERS = [
  { phone: '8801712345678', district: 'Sylhet', upazila: 'Sylhet Sadar', name: 'Test User' },
  { phone: '8801812345679', district: 'Jamalpur', upazila: 'Islampur', name: 'Mina Akter' },
  { phone: '8801912345680', district: 'Kurigram', upazila: 'Chilmari', name: 'Sohel Rana' },
  { phone: '8801612345681', district: 'Gaibandha', upazila: 'Sundarganj', name: 'Rafiq Mia' },
  { phone: '8801512345682', district: 'Bogura', upazila: 'Sariakandi', name: 'Lamia Khatun' },
]

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

async function run() {
  await connectDatabase()
  await sequelize.sync({ alter: true })

  const districtsByName = new Map()

  for (const d of SEED_DISTRICTS) {
    const [district] = await District.findOrCreate({
      where: { name: d.name },
      defaults: { ...d, lastAssessedAt: new Date() },
    })
    await district.update({ ...d, lastAssessedAt: district.lastAssessedAt || new Date() })
    districtsByName.set(district.name, district)
  }
  console.log(`[seed] ensured ${SEED_DISTRICTS.length} districts`)

  const [admin, created] = await User.findOrCreate({
    where: { email: SEED_ADMIN.email },
    defaults: {
      name: SEED_ADMIN.name,
      email: SEED_ADMIN.email,
      passwordHash: SEED_ADMIN.password,
      role: SEED_ADMIN.role,
    },
  })
  const usersByEmail = new Map([[admin.email, admin]])
  console.log(
    created
      ? `[seed] created admin ${admin.email} (password: ${SEED_ADMIN.password})`
      : `[seed] admin ${admin.email} already exists`,
  )

  for (const user of SEED_USERS) {
    const district = districtsByName.get(user.district)
    const [record] = await User.findOrCreate({
      where: { email: user.email },
      defaults: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        passwordHash: user.password,
        role: user.role,
        districtId: district?.id ?? null,
      },
    })
    usersByEmail.set(record.email, record)
  }
  console.log(`[seed] ensured ${SEED_USERS.length} mock users`)

  for (const shelter of SEED_SHELTERS) {
    const district = districtsByName.get(shelter.district)
    await Shelter.findOrCreate({
      where: { name: shelter.name, districtId: district.id },
      defaults: {
        name: shelter.name,
        address: shelter.address,
        capacity: shelter.capacity,
        occupancy: shelter.occupancy,
        latitude: shelter.latitude,
        longitude: shelter.longitude,
        districtId: district.id,
        createdById: admin.id,
        isActive: true,
      },
    })
  }
  console.log(`[seed] ensured ${SEED_SHELTERS.length} shelters`)

  for (const task of SEED_TASKS) {
    const district = districtsByName.get(task.district)
    const assignedTo = task.assignedTo ? usersByEmail.get(task.assignedTo) : null
    await Task.findOrCreate({
      where: { title: task.title, districtId: district.id },
      defaults: {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        districtId: district.id,
        createdById: admin.id,
        assignedToId: assignedTo?.id ?? null,
        acceptedAt: assignedTo && task.status !== 'Open' ? daysAgo(1) : null,
        completedAt: task.status === 'Completed' ? new Date() : null,
      },
    })
  }
  console.log(`[seed] ensured ${SEED_TASKS.length} tasks`)

  for (const report of SEED_REPORTS) {
    const district = districtsByName.get(report.district)
    const reporter = usersByEmail.get(report.reporter)
    await WaterLevelReport.findOrCreate({
      where: {
        districtId: district.id,
        note: report.note,
      },
      defaults: {
        districtId: district.id,
        reportedById: reporter?.id ?? admin.id,
        level: report.level,
        unit: 'm',
        riskLevel: report.riskLevel,
        note: report.note,
        latitude: report.latitude,
        longitude: report.longitude,
        observedAt: daysAgo(report.daysAgo),
      },
    })
  }
  console.log(`[seed] ensured ${SEED_REPORTS.length} water-level reports`)

  for (const alert of SEED_ALERTS) {
    const district = alert.district ? districtsByName.get(alert.district) : null
    await Alert.findOrCreate({
      where: { title: alert.title },
      defaults: {
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        districtId: district?.id ?? null,
        issuedById: admin.id,
        issuedAt: hoursFromNow(-alert.hoursAgo),
        expiresAt: hoursFromNow(alert.expiresInHours),
      },
    })
  }
  console.log(`[seed] ensured ${SEED_ALERTS.length} alerts`)

  for (const subscriber of SEED_SUBSCRIBERS) {
    await upsertSubscriber(subscriber)
  }
  console.log(`[seed] ensured ${SEED_SUBSCRIBERS.length} SMS subscribers`)

  await sequelize.close()
}

run().catch((err) => {
  console.error('[seed] failed:', err)
  process.exit(1)
})
