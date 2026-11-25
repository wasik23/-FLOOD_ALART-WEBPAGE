import { requestJson } from './api.js'

export async function getImpactStats({ signal } = {}) {
  const payload = await requestJson('/api/impact-stats', { signal, cache: 'no-store' })
  const donationsTaka = Number(payload.donationsTaka)
  if (
    !['string', 'number'].includes(typeof payload.donationsTaka) || payload.donationsTaka === '' ||
    !Number.isFinite(donationsTaka) || donationsTaka < 0 ||
    !['familiesHelped', 'activeVolunteers', 'reliefCampsOpen'].every(
      (key) => Number.isSafeInteger(payload[key]) && payload[key] >= 0,
    ) || !payload.updatedAt || Number.isNaN(new Date(payload.updatedAt).getTime())
  ) {
    throw new Error('Invalid impact statistics response.')
  }
  return { ...payload, donationsTaka }
}
