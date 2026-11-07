import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Subscriber } from '../models/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data')
const dbFile = join(dataDir, 'subscribers.json')

let cache = null
let writeChain = Promise.resolve()

async function loadFromDisk() {
  try {
    const raw = await readFile(dbFile, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function ensureLoaded() {
  if (cache) return cache
  cache = await loadFromDisk()
  return cache
}

async function persist() {
  await mkdir(dataDir, { recursive: true })
  await writeFile(dbFile, JSON.stringify(cache, null, 2), 'utf8')
}

function queueWrite() {
  writeChain = writeChain.then(persist).catch((error) => {
    console.error('[subscriberStore] failed to persist:', error)
  })
  return writeChain
}

export async function upsertSubscriber({ phone, district, upazila, name }) {
  const [subscriber] = await Subscriber.upsert(
    {
      phone,
      district,
      upazila,
      name: name ?? null,
      isActive: true,
      unsubscribedAt: null,
    },
    { returning: true },
  )

  // Keep the legacy JSON mirror so existing mock data and downgrade paths survive.
  const list = await ensureLoaded()
  const now = new Date().toISOString()
  const existing = list.find((entry) => entry.phone === phone)

  if (existing) {
    existing.district = district
    existing.upazila = upazila
    if (name !== undefined) existing.name = name
    existing.updatedAt = now
    await queueWrite()
    return subscriber.toJSON()
  }

  const record = {
    phone,
    district,
    upazila,
    name: name ?? null,
    createdAt: now,
    updatedAt: now,
  }
  list.push(record)
  await queueWrite()
  return subscriber.toJSON()
}

export async function listSubscribers(filter = {}) {
  const where = { isActive: true }
  if (filter.district) where.district = filter.district
  if (filter.upazila) where.upazila = filter.upazila
  return Subscriber.findAll({ where, order: [['createdAt', 'DESC']], raw: true })
}

export async function removeSubscriber(phone) {
  const [updated] = await Subscriber.update(
    { isActive: false, unsubscribedAt: new Date() },
    { where: { phone, isActive: true } },
  )
  const list = await ensureLoaded()
  const index = list.findIndex((entry) => entry.phone === phone)
  if (index !== -1) {
    list.splice(index, 1)
    await queueWrite()
  }
  return updated > 0 || index !== -1
}

export async function migrateLegacySubscribers() {
  const legacy = await ensureLoaded()
  if (legacy.length === 0) return 0
  for (const entry of legacy) {
    await Subscriber.upsert({
      phone: entry.phone,
      district: entry.district,
      upazila: entry.upazila,
      name: entry.name ?? null,
      isActive: true,
      consentedAt: entry.createdAt || new Date(),
    })
  }
  return legacy.length
}
