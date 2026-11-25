// Read-only homepage previews; these values are never written to the datastore.
export function getMockImpactStats() {
  return {
    donationsTaka: 4820000,
    familiesHelped: 12430,
    activeVolunteers: 1284,
    reliefCampsOpen: 76,
    updatedAt: new Date().toISOString(),
  }
}

export function getMockDonations(now = Date.now()) {
  return [
    { id: 'mock-rahim', displayName: 'Rahim U.', amount: '500', minutesAgo: 2 },
    { id: 'mock-anonymous-1', displayName: 'Anonymous', amount: '2000', minutesAgo: 5 },
    { id: 'mock-nusrat', displayName: 'Nusrat J.', amount: '1000', minutesAgo: 8 },
    { id: 'mock-anonymous-2', displayName: 'Anonymous', amount: '5000', minutesAgo: 14 },
  ].map(({ minutesAgo, ...donation }) => ({
    ...donation,
    receivedAt: new Date(now - minutesAgo * 60000).toISOString(),
  }))
}
