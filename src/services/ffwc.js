export async function getLiveWaterLevels({ signal } = {}) {
  const response = await fetch('/api/ffwc/water-levels', { signal })

  if (!response.ok) {
    throw new Error('Could not load FFWC water levels.')
  }

  return response.json()
}
