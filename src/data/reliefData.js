export const DONATION_ACCOUNTS_KEY = 'reliefops_donation_accounts'
export const VOLUNTEER_PROFILES_KEY = 'reliefops_volunteer_profiles'
export const HELP_REQUESTS_KEY = 'reliefops_help_requests'

export const defaultDonationAccounts = [
  {
    id: 'bkash-personal',
    type: 'Mobile banking',
    label: 'bKash',
    accountName: 'ReliefOps Emergency Fund',
    accountNumber: '01712-345678',
    branch: 'Send Money',
    instructions: 'Use reference FLOODRELIEF and keep your transaction ID.',
  },
  {
    id: 'nagad-merchant',
    type: 'Mobile banking',
    label: 'Nagad',
    accountName: 'ReliefOps Donation',
    accountNumber: '01898-765432',
    branch: 'Merchant Payment',
    instructions: 'Use counter number 01 for flood response donations.',
  },
  {
    id: 'dbbl-bank',
    type: 'Bank transfer',
    label: 'Dutch-Bangla Bank',
    accountName: 'ReliefOps Foundation',
    accountNumber: '110.120.123456',
    branch: 'Motijheel Branch',
    instructions: 'Routing: 090271234. Email deposit slip to accounts@reliefops.org.',
  },
  {
    id: 'brac-bank',
    type: 'Bank transfer',
    label: 'BRAC Bank',
    accountName: 'ReliefOps Foundation',
    accountNumber: '1520200001234001',
    branch: 'Gulshan Branch',
    instructions: 'Mention donor name and phone in the transfer note.',
  },
]

export const waterLevelForecasts = [
  {
    area: 'Sylhet Sadar',
    river: 'Surma',
    level: '13.8 m',
    trend: 'Rising',
    risk: 'Critical',
    forecast: 'May cross danger level within 12 hours.',
  },
  {
    area: 'Sunamganj',
    river: 'Kushiyara',
    level: '12.4 m',
    trend: 'Rising',
    risk: 'High',
    forecast: 'Low-lying unions should prepare evacuation support.',
  },
  {
    area: 'Kurigram',
    river: 'Brahmaputra',
    level: '19.2 m',
    trend: 'Stable',
    risk: 'Medium',
    forecast: 'Char areas may remain waterlogged through tomorrow.',
  },
  {
    area: 'Feni',
    river: 'Muhuri',
    level: '8.7 m',
    trend: 'Falling',
    risk: 'Low',
    forecast: 'Road access is improving; continue monitoring embankments.',
  },
]

export const floodNews = [
  {
    id: 'news-sylhet-route',
    title: 'Relief route opened for Kanaighat shelters',
    area: 'Sylhet',
    time: 'Today, 9:30 AM',
    summary:
      'Volunteer teams reopened one road link and moved water purification tablets to three shelters.',
  },
  {
    id: 'news-sunamganj-boats',
    title: 'Boat support requested in low-lying villages',
    area: 'Sunamganj',
    time: 'Today, 8:15 AM',
    summary:
      'Local coordinators are prioritizing rescue boats, dry food, and medicine for families still cut off by floodwater.',
  },
  {
    id: 'news-kurigram-health',
    title: 'Mobile medical desk planned near char areas',
    area: 'Kurigram',
    time: 'Yesterday, 6:40 PM',
    summary:
      'Health volunteers are preparing ORS, fever medicine, and basic triage support for waterlogged communities.',
  },
]

function readJson(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getDonationAccounts() {
  const accounts = readJson(DONATION_ACCOUNTS_KEY, null)
  return Array.isArray(accounts) ? accounts : defaultDonationAccounts
}

export function saveDonationAccounts(accounts) {
  writeJson(DONATION_ACCOUNTS_KEY, accounts)
}

export function getVolunteerProfiles() {
  const profiles = readJson(VOLUNTEER_PROFILES_KEY, [])
  return Array.isArray(profiles) ? profiles : []
}

export function saveVolunteerProfiles(profiles) {
  writeJson(VOLUNTEER_PROFILES_KEY, profiles)
}

export function upsertVolunteerProfile(profile) {
  const profiles = getVolunteerProfiles()
  const existingIndex = profiles.findIndex((item) => item.userId === profile.userId)
  const nextProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  }

  if (existingIndex === -1) {
    saveVolunteerProfiles([nextProfile, ...profiles])
    return nextProfile
  }

  const nextProfiles = [...profiles]
  nextProfiles[existingIndex] = {
    ...nextProfiles[existingIndex],
    ...nextProfile,
  }
  saveVolunteerProfiles(nextProfiles)
  return nextProfiles[existingIndex]
}

export function getHelpRequests() {
  const requests = readJson(HELP_REQUESTS_KEY, [])
  return Array.isArray(requests) ? requests : []
}

export function saveHelpRequests(requests) {
  writeJson(HELP_REQUESTS_KEY, requests)
}

export function createHelpRequest(request) {
  const requests = getHelpRequests()
  const nextRequest = {
    ...request,
    id: `request_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  saveHelpRequests([nextRequest, ...requests])
  return nextRequest
}

export function updateHelpRequest(requestId, updates) {
  const requests = getHelpRequests()
  const nextRequests = requests.map((request) =>
    request.id === requestId
      ? { ...request, ...updates, updatedAt: new Date().toISOString() }
      : request,
  )
  saveHelpRequests(nextRequests)
  return nextRequests.find((request) => request.id === requestId) || null
}
