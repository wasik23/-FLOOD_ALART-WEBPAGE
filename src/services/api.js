export async function requestJson(path, { token, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(response.ok ? 'The server returned an invalid response.' : `Request failed (${response.status}).`)
  }
  if (!response.ok) {
    const error = new Error(payload.details?.[0]?.msg || payload.error || `Request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return payload
}
