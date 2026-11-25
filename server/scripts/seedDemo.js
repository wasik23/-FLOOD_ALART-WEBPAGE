/* eslint-env node */
import 'dotenv/config'
import { connectDatabase } from '../config/database.js'
import { sequelize, User, District, VolunteerProfile, HelpRequest, DonationReceipt, DonationAccount, Shelter, Task, Alert, AuditEntry, WaterLevelReport } from '../models/index.js'
import { migrateDashboard } from '../migrations/dashboard.js'
import { migrateImpactStats } from '../migrations/impactStats.js'

const password = process.env.SEED_DEMO_PASSWORD || 'DemoRelief!2026'
const ago = (days, minutes = 0) => new Date(Date.now() - days * 86400000 - minutes * 60000)
const stableId = (group, index) => `${group}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Sample data is intended for development databases.')
  await connectDatabase()
  await sequelize.sync()
  await migrateDashboard()
  await migrateImpactStats()
  const created = {}
  await sequelize.transaction(async (transaction) => {
    // Existing records, passwords, edits and outcomes are preserved on subsequent runs.
    const ensure = async (model, where, defaults) => {
      const [record, inserted] = await model.findOrCreate({ where, defaults, transaction })
      created[model.tableName] = (created[model.tableName] || 0) + Number(inserted)
      return record
    }
    const districts = {}
    for (const [name, division, riskLevel, riverWaterLevel] of [
      ['Sylhet', 'Sylhet', 'Critical', 8.12], ['Sunamganj', 'Sylhet', 'High', 7.4],
      ['Kurigram', 'Rangpur', 'High', 5.9], ['Dhaka', 'Dhaka', 'Low', 2.4],
    ]) districts[name] = await ensure(District, { name }, { name, division, riskLevel, riverWaterLevel, lastAssessedAt: new Date() })
    for (const [email, name, role, district] of [
      ['admin@example.com', 'Development Admin', 'admin', 'Dhaka'],
      ['coordinator@example.com', 'Development NGO Coordinator', 'coordinator', 'Sylhet'],
      ['volunteer@example.com', 'Development Volunteer', 'volunteer', 'Sylhet'],
    ]) {
      const record = await ensure(User, { email }, {
        name, email, role, passwordHash: process.env.SEED_DEMO_PASSWORD || 'password',
        districtId: districts[district].id, approvalStatus: 'Approved', isActive: true,
      })
      if (record.role !== role) throw new Error(`Account role conflict for ${email}; sample transaction rolled back.`)
    }
    const users = {}
    for (const [key, name, role, district, approvalStatus, isActive] of [
      ['admin', 'Sample Platform Admin', 'admin', 'Dhaka', 'Approved', true],
      ['coordinator', 'Sample Sylhet Relief Team', 'coordinator', 'Sylhet', 'Approved', true],
      ['ngo-sunamganj', 'Sample Sunamganj Response', 'coordinator', 'Sunamganj', 'Pending', true],
      ['ngo-kurigram', 'Sample Kurigram Support', 'coordinator', 'Kurigram', 'Pending', true],
      ['ngo-paused', 'Sample Paused Organization', 'coordinator', 'Dhaka', 'Approved', false],
      ['nusrat', 'Sample Nusrat Jahan', 'volunteer', 'Sylhet', 'Approved', true],
      ['rahim', 'Sample Rahim Uddin', 'volunteer', 'Sylhet', 'Approved', true],
      ['amina', 'Sample Amina Khatun', 'volunteer', 'Sunamganj', 'Approved', true],
      ['arif', 'Sample Arif Hossain', 'volunteer', 'Kurigram', 'Approved', true],
    ]) {
      const email = `demo.${key}@example.test`
      users[key] = await ensure(User, { email }, { name, email, role, passwordHash: password, districtId: districts[district].id, approvalStatus, isActive })
      if (users[key].role !== role) throw new Error(`Account role conflict for ${email}; sample transaction rolled back.`)
    }
    for (const [index, key, location, skills, availability, verified] of [
      [1, 'nusrat', 'Sylhet Sadar', ['Medical support', 'First aid'], 'Available', true],
      [2, 'rahim', 'Kanaighat', ['Water & sanitation', 'Transport'], 'Available', true],
      [3, 'amina', 'Sunamganj Sadar', ['Rescue support'], 'Busy', true],
      [4, 'arif', 'Chilmari', ['Food distribution'], 'Available', false],
    ]) {
      const user = users[key]
      await ensure(VolunteerProfile, { userId: user.id }, {
        name: user.name, email: user.email, phone: `DEMO-CONTACT-${index}`, address: `Sample response area, ${location}`,
        location, skills, availability, verified, isActive: true,
        fieldReports: verified ? [{ id: `demo-field-${key}`, notes: 'Sample supplies delivered; awaiting outcome review.', status: 'Completed', taskLocation: location, createdAt: ago(0, index * 20).toISOString() }] : [],
      })
    }
    const requests = [
      ['Sylhet', 'Kanaighat', 'Rescue', 36, 'Pending', 0, null],
      ['Sylhet', 'Sylhet Sadar', 'Medicine', 15, 'Pending', 0, null],
      ['Sylhet', 'Golapganj', 'Food', 12, 'Assigned', 0, 'rahim'],
      ['Sylhet', 'Beanibazar', 'Shelter', 8, 'Pending', 0, null],
      ['Sylhet', 'Sylhet Sadar', 'Medicine', 24, 'Assigned', 0, 'nusrat'],
      ['Sunamganj', 'Sunamganj Sadar', 'Clean water', 42, 'Assigned', 0, 'amina'],
      ['Kurigram', 'Chilmari', 'Food', 18, 'Pending', 0, null],
      ['Sylhet', 'Sylhet Sadar', 'Food', 30, 'Completed', 6, 'rahim'],
      ['Sylhet', 'Kanaighat', 'Medicine', 20, 'Completed', 4, 'nusrat'],
      ['Sunamganj', 'Sunamganj Sadar', 'Shelter', 40, 'Completed', 8, 'amina'],
      ['Kurigram', 'Chilmari', 'Food', 25, 'Completed', 5, null],
      ['Sylhet', 'Golapganj', 'Other', 4, 'Cancelled', 0, null],
    ]
    for (const [index, row] of requests.entries()) {
      const [district, upazila, needType, peopleCount, status, familiesHelped, volunteer] = row
      await ensure(HelpRequest, { id: stableId('1', index + 1) }, {
        name: `Sample Household ${index + 1}`, phone: `DEMO-HOUSEHOLD-${index + 1}`, district, upazila,
        address: `Sample address ${index + 1}, ${upazila}`, needType, peopleCount, status, familiesHelped,
        assignedToId: volunteer ? users[volunteer].id : null, notes: 'Development sample; not a real assistance request.', createdAt: ago(0, 30 + index * 12),
      })
    }
    for (const [index, amount] of [500, 2000, 1000, 5000, 15000, 25000, 30000, 45000, 10000, 20000, 35000, 50000, 75000, 12000].entries()) {
      await ensure(DonationReceipt, { reference: `DEMO-RECEIPT-${String(index + 1).padStart(3, '0')}` }, {
        amount: String(amount), donorName: index % 2 ? 'Sample Community Fund' : 'Sample Individual Donor',
        isAnonymous: index % 3 !== 0, channel: ['Cash', 'bKash', 'Nagad', 'Bank transfer'][index % 4], status: 'Received',
        receivedAt: ago(Math.floor(index / 2), (index % 2) * 30 + 5), recordedById: users.admin.id,
        notes: 'Development sample receipt; no real money was received.',
      })
    }
    await ensure(DonationReceipt, { reference: 'DEMO-RECEIPT-REFUNDED' }, {
      amount: '2500', donorName: 'Sample Refund', isAnonymous: true, channel: 'Cash', status: 'Refunded',
      receivedAt: ago(2), recordedById: users.admin.id, notes: 'Development refund example; excluded from totals.',
    })
    await ensure(DonationAccount, { id: 'demo-inactive-account' }, {
      type: 'Bank transfer', label: 'Sample account (inactive)', accountName: 'Sample Relief Fund', accountNumber: 'SAMPLE-ONLY',
      instructions: 'Development example. Replace with verified payment details before activating.', isActive: false, updatedById: users.admin.id,
    })
    for (const [index, district, location, capacity, occupancy, latitude, longitude] of [
      [1, 'Sylhet', 'Sylhet Sadar', 300, 270, 24.8949, 91.8687], [2, 'Sylhet', 'Kanaighat', 200, 105, 25.0138, 92.1019],
      [3, 'Sunamganj', 'Sunamganj Sadar', 250, 220, 25.0658, 91.3950], [4, 'Kurigram', 'Chilmari', 180, 90, 25.5566, 89.6728],
    ]) await ensure(Shelter, { name: `Sample Relief Shelter ${index}`, districtId: districts[district].id }, {
      address: `Sample shelter, ${location}`, capacity, occupancy, latitude, longitude, isActive: true, createdById: users.admin.id,
    })
    for (const [index, title, priority, status, key] of [
      [1, 'Sample: deliver medical supplies', 'High', 'Open', null],
      [2, 'Sample: distribute water purification kits', 'High', 'Accepted', 'rahim'],
      [3, 'Sample: verify shelter supplies', 'Medium', 'Completed', 'nusrat'],
    ]) await ensure(Task, { title, districtId: districts.Sylhet.id }, {
      description: 'Development sample field task.', priority, status, createdById: users.coordinator.id,
      assignedToId: key ? users[key].id : null, acceptedAt: key ? ago(1) : null, completedAt: index === 3 ? ago(0, 45) : null,
    })
    for (const district of ['Sylhet', 'Sunamganj', 'Kurigram']) {
      await ensure(Alert, { title: `Sample flood warning: ${district}` }, {
        message: 'Development sample warning. Review shelter capacity and response readiness.', severity: districts[district].riskLevel,
        districtId: districts[district].id, issuedById: users.admin.id, issuedAt: ago(0, 60), expiresAt: new Date(Date.now() + 7 * 86400000),
      })
      await ensure(WaterLevelReport, { districtId: districts[district].id, note: `Sample river assessment: ${district}` }, {
        reportedById: users.coordinator.id, level: districts[district].riverWaterLevel || 5, unit: 'm', riskLevel: districts[district].riskLevel, observedAt: ago(0, 60),
      })
    }
    await ensure(AuditEntry, { id: stableId('2', 1) }, { actorId: users.admin.id, action: 'Sample records initialized', detail: 'Development donations, requests, volunteers, shelters, tasks and NGO accounts inserted.' })
  })
  console.log('[demo seed] newly inserted records:', JSON.stringify(created))
  console.log('[demo seed] documented development logins: admin@example.com / coordinator@example.com / volunteer@example.com; initial password is password unless SEED_DEMO_PASSWORD is configured.')
  console.log('[demo seed] logins: demo.admin@example.test / demo.coordinator@example.test; passwords use SEED_DEMO_PASSWORD or the documented development default. Existing passwords preserved.')
}

seed().catch((error) => {
  console.error('[demo seed] failed:', error.name, error.original?.code || error.message)
  process.exitCode = 1
}).finally(() => sequelize.close())
