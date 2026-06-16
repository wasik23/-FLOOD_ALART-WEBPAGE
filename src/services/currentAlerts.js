const listeners = new Set()
let snapshot = {
  alerts: [],
  loaded: false,
  loading: false,
}

function important(alert) {
  const severity = alert.severity || alert.riskLevel
  return severity === 'High' || severity === 'Critical'
}

function normalizeServerAlert(alert) {
  return {
    ...alert,
    district: alert.district?.name || alert.district || alert.districtName || 'Bangladesh',
    id: String(alert.id || `${alert.severity}-${alert.district || Date.now()}`),
    timestamp: alert.issuedAt || alert.timestamp || new Date().toISOString(),
  }
}

function updateSnapshot(nextSnapshot) {
  snapshot = nextSnapshot
  listeners.forEach((listener) => listener())
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not load ${url}`)
  }

  return response.json()
}

export function subscribeCurrentAlerts(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCurrentAlertsSnapshot() {
  return snapshot
}

export function loadCurrentAlerts() {
  if (snapshot.loading || snapshot.loaded) return

  updateSnapshot({ ...snapshot, loading: true })

  Promise.allSettled([
    fetchJson('/api/alerts?activeOnly=true&limit=10'),
    fetchJson('/events/water-level/current'),
  ]).then((results) => {
    const alerts = results
      .flatMap((result) =>
        result.status === 'fulfilled' ? result.value.alerts || [] : [],
      )
      .map(normalizeServerAlert)
      .filter(important)

    updateSnapshot({
      alerts,
      loaded: true,
      loading: false,
    })
  })
}
