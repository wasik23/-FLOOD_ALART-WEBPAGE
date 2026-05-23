export const DISTRICT_RISK_CACHE = 'district-risk-snapshot-v1'
export const DISTRICT_RISK_SNAPSHOT_URL = '/offline-risk-levels.json'

export async function cacheDistrictRiskSnapshot(districtRisks) {
  if (!('caches' in window)) {
    return
  }

  const snapshot = {
    cachedAt: new Date().toISOString(),
    districts: districtRisks,
  }

  const cache = await caches.open(DISTRICT_RISK_CACHE)
  await cache.put(
    DISTRICT_RISK_SNAPSHOT_URL,
    new Response(JSON.stringify(snapshot), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }),
  )
}
