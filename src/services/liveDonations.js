import { requestJson } from './api.js'

export async function getLiveDonations({ signal } = {}) {
  const payload = await requestJson('/api/donations/live?limit=4', { signal, cache: 'no-store' })
  if (!Array.isArray(payload.donations) || !payload.donations.every((donation) =>
    typeof donation.id === 'string' && donation.id &&
    typeof donation.displayName === 'string' && donation.displayName &&
    ['string', 'number'].includes(typeof donation.amount) &&
    Number.isFinite(Number(donation.amount)) && Number(donation.amount) > 0 &&
    typeof donation.receivedAt === 'string' && !Number.isNaN(new Date(donation.receivedAt).getTime()),
  )) {
    throw new Error('Invalid live donations response.')
  }
  return payload.donations
}
