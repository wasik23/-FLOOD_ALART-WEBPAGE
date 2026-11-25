import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import express from 'express'
import { UniqueConstraintError } from 'sequelize'
import { AuditEntry, DonationReceipt, HelpRequest, Shelter, User, VolunteerProfile, sequelize } from '../models/index.js'
import { signToken } from '../middleware/auth.js'
import { errorHandler } from '../middleware/errorHandler.js'
import impactStatsRouter from '../routes/impactStats.js'
import donationsRouter from '../routes/donations.js'
import helpRequestsRouter from '../routes/helpRequests.js'
import { migrateImpactStats } from '../migrations/impactStats.js'

const receiptId = 'c16dc8b3-0d7a-42da-8fc2-25b97d398991'
const requestId = '9684b842-2687-4b73-9a33-69db59016404'
const cents = (amount) => {
  const [whole, fraction = ''] = String(amount).split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}
const amountFromCents = (value) => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`

test('datastore-backed impact statistics and operator recording', async (t) => {
  const users = ['admin', 'coordinator', 'volunteer', 'citizen'].map((role, index) =>
    User.build({ id: index + 1, name: `Test ${role}`, role, email: `${role}@example.test` }),
  )
  let receipts = []
  let requests = []
  let profiles = []
  let shelters = []
  const donationEvents = []
  const transaction = { LOCK: { UPDATE: 'UPDATE' } }
  t.mock.method(sequelize, 'transaction', async (callback) => callback(transaction))
  t.mock.method(AuditEntry, 'create', async (values, options) => {
    assert.equal(options.transaction, transaction)
    return values
  })
  t.mock.method(User, 'findByPk', async (id) => users.find((user) => user.id === Number(id)))
  t.mock.method(DonationReceipt, 'create', async (values) => {
    if (receipts.some((receipt) => receipt.reference === values.reference)) throw new UniqueConstraintError()
    const receipt = { id: receipts.length === 0 ? receiptId : randomUUID(), receivedAt: new Date().toISOString(), ...values }
    receipt.update = async (updates) => Object.assign(receipt, updates)
    receipts.push(receipt)
    return receipt
  })
  t.mock.method(DonationReceipt, 'findByPk', async (id) => receipts.find((receipt) => receipt.id === id))
  t.mock.method(DonationReceipt, 'findAndCountAll', async ({ limit, offset }) => ({ count: receipts.length, rows: receipts.slice(offset, offset + limit) }))
  t.mock.method(DonationReceipt, 'findAll', async (options) => {
    assert.deepEqual(options.attributes, ['id', 'amount', 'donorName', 'isAnonymous', 'receivedAt'])
    assert.deepEqual(options.order, [['receivedAt', 'DESC'], ['createdAt', 'DESC']])
    assert.equal(options.where.status, 'Received')
    return receipts.filter((receipt) => receipt.status === 'Received')
      .sort((first, second) => new Date(second.receivedAt) - new Date(first.receivedAt))
      .slice(0, options.limit)
  })
  t.mock.method(DonationReceipt, 'findOne', async (options) => {
    assert.equal(options.where.status, 'Received')
    assert.equal(options.raw, true)
    const total = receipts.filter((receipt) => receipt.status === options.where.status).reduce((sum, receipt) => sum + cents(receipt.amount), 0n)
    return { total: amountFromCents(total) }
  })
  t.mock.method(HelpRequest, 'create', async (values) => {
    const request = { id: requestId, ...values }
    request.update = async (updates) => Object.assign(request, updates)
    requests.push(request)
    return request
  })
  t.mock.method(HelpRequest, 'findByPk', async (id) => requests.find((request) => request.id === id))
  t.mock.method(HelpRequest, 'sum', async (field, options) => {
    assert.equal(field, 'familiesHelped')
    assert.equal(options.where.status, 'Completed')
    return requests.filter((request) => request.status === options.where.status).reduce((sum, request) => sum + request.familiesHelped, 0)
  })
  t.mock.method(VolunteerProfile, 'count', async (options) => {
    assert.equal(options.where.isActive, true)
    assert.equal(options.include[0].where.role, 'volunteer')
    assert.equal(options.include[0].required, true)
    return profiles.filter((profile) => profile.isActive && profile.role === 'volunteer').length
  })
  t.mock.method(Shelter, 'count', async (options) => {
    assert.equal(options.where.isActive, true)
    return shelters.filter((shelter) => shelter.isActive).length
  })

  const app = express()
  app.set('io', { emit: (event, payload) => donationEvents.push({ event, payload }) })
  app.use(express.json())
  app.use('/api/impact-stats', impactStatsRouter)
  app.use('/api/donations', donationsRouter)
  app.use('/api/help-requests', helpRequestsRouter)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const send = async (path, { role = 'admin', method = 'GET', body } = {}) => {
    const user = users.find((candidate) => candidate.role === role)
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user && { Authorization: `Bearer ${signToken(user)}` }) },
      ...(body && { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json(), headers: response.headers }
  }

  await t.test('public totals report genuine zeroes for an empty datastore', async () => {
    const response = await send('/api/impact-stats', { role: null })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual({ ...response.body, updatedAt: undefined }, {
      donationsTaka: '0.00', familiesHelped: 0, activeVolunteers: 0, reliefCampsOpen: 0, updatedAt: undefined,
    })
    assert.ok(!Number.isNaN(new Date(response.body.updatedAt).getTime()))
  })

  await t.test('only operators can create or read donation receipts', async () => {
    const body = { amount: '100.00', reference: 'ACCESS-TEST', channel: 'Cash' }
    for (const role of [null, 'volunteer', 'citizen']) {
      assert.equal((await send('/api/donations/receipts', { role })).status, role ? 403 : 401)
      assert.equal((await send('/api/donations/receipts', { role, method: 'POST', body })).status, role ? 403 : 401)
    }
    assert.equal(receipts.length, 0)
    assert.equal((await send('/api/donations/receipts', { role: 'coordinator' })).status, 200)
  })

  await t.test('receipt writes preserve decimals, prevent duplicates and protect actor/status fields', async () => {
    for (const [reference, amount] of [['BDT-01', '0.10'], ['BDT-02', '0.20']]) {
      const response = await send('/api/donations/receipts', {
        method: 'POST', body: { reference, amount, channel: 'bKash', donorName: 'Private donor', recordedById: 999, status: 'Refunded' },
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.receipt.recordedById, 1)
      assert.equal(response.body.receipt.status, 'Received')
      assert.equal(response.body.receipt.isAnonymous, true)
      assert.equal(response.body.receipt.amount, amount)
    }
    assert.equal((await send('/api/donations/receipts', { method: 'POST', body: { reference: 'BDT-01', amount: '0.10', channel: 'Cash' } })).status, 409)
    const totals = await send('/api/impact-stats', { role: null })
    assert.equal(totals.body.donationsTaka, '0.30')
    assert.ok(!JSON.stringify(totals.body).includes('Private donor'))
  })

  await t.test('invalid money amounts and unknown channels are rejected before storage', async () => {
    const previousCount = receipts.length
    for (const amount of ['0', '-1', '1.234', '1e3', 'Infinity', '1000000000000', true]) {
      assert.equal((await send('/api/donations/receipts', { method: 'POST', body: { reference: 'INVALID', amount, channel: 'Cash' } })).status, 400)
    }
    assert.equal((await send('/api/donations/receipts', { method: 'POST', body: { reference: 'INVALID', amount: '10', channel: 'Unknown' } })).status, 400)
    assert.equal(receipts.length, previousCount)
  })

  await t.test('refunds change the total without changing the original amount or recorder', async () => {
    const response = await send(`/api/donations/receipts/${receiptId}`, {
      role: 'coordinator', method: 'PATCH', body: { status: 'Refunded', amount: '99999', recordedById: 999 },
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.receipt.amount, '0.10')
    assert.equal(response.body.receipt.recordedById, 1)
    assert.equal(response.body.receipt.updatedById, 2)
    assert.equal((await send('/api/impact-stats', { role: null })).body.donationsTaka, '0.20')
  })

  await t.test('public requests cannot forge family outcomes; completion requires a recorded count', async () => {
    const created = await send('/api/help-requests', {
      role: null, method: 'POST', body: {
        name: 'Test household', phone: '01712345678', district: 'Sylhet', upazila: 'Sylhet Sadar', address: 'Test village',
        needType: 'Food', peopleCount: 20, familiesHelped: 9999, status: 'Completed', assignedToId: 999,
      },
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.request.status, 'Pending')
    assert.equal(created.body.request.familiesHelped, 0)
    assert.equal(created.body.request.assignedToId, undefined)
    assert.equal((await send(`/api/help-requests/${requestId}`, { method: 'PATCH', body: { status: 'Completed' } })).status, 400)
    const completed = await send(`/api/help-requests/${requestId}`, { method: 'PATCH', body: { status: 'Completed', familiesHelped: 4 } })
    assert.equal(completed.status, 200)
    assert.equal((await send('/api/impact-stats', { role: null })).body.familiesHelped, 4)
    assert.equal((await send(`/api/help-requests/${requestId}`, { role: 'volunteer', method: 'PATCH', body: { familiesHelped: 50 } })).status, 403)
    for (const familiesHelped of [-1, 0, 1.5, 10001]) {
      assert.equal((await send(`/api/help-requests/${requestId}`, { method: 'PATCH', body: { familiesHelped } })).status, 400)
    }
    await send(`/api/help-requests/${requestId}`, { method: 'PATCH', body: { status: 'Cancelled' } })
    assert.equal((await send('/api/impact-stats', { role: null })).body.familiesHelped, 0)
  })

  await t.test('active counts exclude inactive profiles, non-volunteer profiles and inactive camps', async () => {
    profiles = [{ isActive: true, role: 'volunteer' }, { isActive: false, role: 'volunteer' }, { isActive: true, role: 'coordinator' }]
    shelters = [{ isActive: true }, { isActive: false }, { isActive: true }]
    const totals = await send('/api/impact-stats', { role: null })
    assert.equal(totals.body.activeVolunteers, 1)
    assert.equal(totals.body.reliefCampsOpen, 2)
  })

  await t.test('aggregation and authentication datastore failures reach error handling', async (subtest) => {
    subtest.mock.method(console, 'error', () => {})
    const failure = Object.assign(new Error('Datastore unavailable'), { status: 503, expose: true })
    subtest.mock.method(Shelter, 'count', async () => { throw failure })
    assert.equal((await send('/api/impact-stats', { role: null })).status, 503)
    subtest.mock.method(User, 'findByPk', async () => { throw failure })
    assert.equal((await send('/api/donations/receipts')).status, 503)
  })

  await t.test('public live feed protects donor identity and supports operator anonymity changes', async () => {
    const previous = receipts
    receipts = []
    try {
      const anonymous = await send('/api/donations/receipts', {
        method: 'POST', body: {
          reference: 'PRIVATE-REFERENCE', amount: '2000', channel: 'Cash',
          donorName: 'Hidden Fullname', notes: 'Private memo', receivedAt: new Date(Date.now() - 60000).toISOString(),
        },
      })
      const named = await send('/api/donations/receipts', {
        method: 'POST', body: {
          reference: 'NAMED-REFERENCE', amount: '500', channel: 'bKash',
          donorName: 'Rahim Uddin', isAnonymous: false, receivedAt: new Date().toISOString(),
        },
      })
      assert.equal(anonymous.status, 201)
      assert.equal(named.status, 201)
      // MySQL raw BOOLEAN columns may arrive as numeric 0/1.
      receipts.find((receipt) => receipt.id === named.body.receipt.id).isAnonymous = 0
      let feed = await send('/api/donations/live', { role: null })
      assert.equal(feed.status, 200)
      assert.equal(feed.headers.get('cache-control'), 'no-store')
      assert.deepEqual(feed.body.donations.map((donation) => donation.displayName), ['Rahim U.', 'Anonymous'])
      assert.deepEqual(Object.keys(feed.body.donations[0]).sort(), ['amount', 'displayName', 'id', 'receivedAt'])
      for (const privateValue of ['Hidden Fullname', 'Uddin', 'PRIVATE-REFERENCE', 'NAMED-REFERENCE', 'Private memo']) {
        assert.ok(!JSON.stringify(feed.body).includes(privateValue))
      }
      assert.equal((await send('/api/donations/live?limit=1', { role: null })).body.donations.length, 1)
      for (const limit of [0, 21]) assert.equal((await send(`/api/donations/live?limit=${limit}`, { role: null })).status, 400)
      const id = named.body.receipt.id
      assert.equal((await send(`/api/donations/receipts/${id}`, { role: 'volunteer', method: 'PATCH', body: { isAnonymous: true } })).status, 403)
      assert.equal((await send(`/api/donations/receipts/${id}`, { method: 'PATCH', body: { isAnonymous: true } })).status, 200)
      feed = await send('/api/donations/live', { role: null })
      assert.ok(feed.body.donations.every((donation) => donation.displayName === 'Anonymous'))
      await send(`/api/donations/receipts/${id}`, { method: 'PATCH', body: { status: 'Refunded' } })
      assert.equal((await send('/api/donations/live', { role: null })).body.donations.length, 1)
      assert.ok(donationEvents.length > 0)
      assert.ok(donationEvents.every(({ event, payload }) => event === 'donation_update' && Object.keys(payload).join() === 'updatedAt'))
    } finally {
      receipts = previous
    }
  })

  await t.test('migration adds outcome and anonymity columns once with safe defaults', async (subtest) => {
    const queryInterface = sequelize.getQueryInterface()
    const columns = { help_requests: { id: {} }, donation_receipts: { id: {} } }
    const additions = []
    subtest.mock.method(DonationReceipt, 'sync', async () => {})
    subtest.mock.method(HelpRequest, 'sync', async () => {})
    subtest.mock.method(queryInterface, 'describeTable', async (table) => columns[table])
    subtest.mock.method(queryInterface, 'addColumn', async (table, column, definition) => {
      additions.push({ table, column, definition })
      columns[table][column] = definition
    })
    await migrateImpactStats()
    await migrateImpactStats()
    assert.equal(additions.length, 2)
    assert.equal(additions[0].table, 'donation_receipts')
    assert.equal(additions[0].column, 'is_anonymous')
    assert.equal(additions[0].definition.defaultValue, true)
    assert.equal(additions[0].definition.allowNull, false)
    assert.equal(additions[1].table, 'help_requests')
    assert.equal(additions[1].column, 'families_helped')
    assert.equal(additions[1].definition.defaultValue, 0)
    assert.equal(additions[1].definition.allowNull, false)
  })
})
