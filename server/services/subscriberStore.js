import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  const list = await ensureLoaded()
  const now = new Date().toISOString()
  const existing = list.find((entry) => entry.phone === phone)

  if (existing) {
    existing.district = district
    existing.upazila = upazila
    if (name !== undefined) existing.name = name
    existing.updatedAt = now
    await queueWrite()
    return existing
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
  return record
}

export async function listSubscribers(filter = {}) {
  const list = await ensureLoaded()
  return list.filter((entry) => {
    if (filter.district && entry.district !== filter.district) return false
    if (filter.upazila && entry.upazila !== filter.upazila) return false
    return true
  })
}

export async function removeSubscriber(phone) {
  const list = await ensureLoaded()
  const index = list.findIndex((entry) => entry.phone === phone)
  if (index === -1) return false
  list.splice(index, 1)
  await queueWrite()
  return true
}
