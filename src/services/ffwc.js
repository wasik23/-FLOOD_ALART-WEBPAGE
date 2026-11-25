export async function getLiveWaterLevels({ signal } = {}) {
  const response = await fetch('/api/ffwc/water-levels', { signal, cache: 'no-store' })

  if (!response.ok) {
    throw new Error('Could not load FFWC water levels.')
  }

  const payload = await response.json()
  if (!Array.isArray(payload.waterLevels)) throw new Error('Invalid FFWC water-level response.')
  return payload
}
