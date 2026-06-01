import { ROLES } from './roles.js'

const TOKEN_KEY = 'auth_token'
const USERS_KEY = 'mock_auth_users'
const ISSUER = 'final-dev-auth'

const seedUsers = [
  {
    id: 'usr_volunteer',
    name: 'Volunteer User',
    email: 'volunteer@example.com',
    password: 'password',
    role: ROLES.VOLUNTEER,
  },
  {
    id: 'usr_coordinator',
    name: 'NGO Coordinator',
    email: 'coordinator@example.com',
    password: 'password',
    role: ROLES.NGO,
  },
  {
    id: 'usr_admin',
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password',
    role: ROLES.ADMIN,
  },
]

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

const encodeBase64Url = (value) =>
  btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  )

  return JSON.parse(atob(padded))
}

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role === 'ngo' ? ROLES.NGO : user.role,
})

const createMockJwt = (user) => {
  const now = Math.floor(Date.now() / 1000)
  const safeUser = sanitizeUser(user)

  return [
    encodeBase64Url({ alg: 'HS256', typ: 'JWT' }),
    encodeBase64Url({
      sub: safeUser.id,
      iss: ISSUER,
      iat: now,
      exp: now + 60 * 60 * 8,
      user: safeUser,
    }),
    'mock-signature',
  ].join('.')
}

const readUsers = () => {
  const storedUsers = localStorage.getItem(USERS_KEY)

  if (!storedUsers) {
    localStorage.setItem(USERS_KEY, JSON.stringify(seedUsers))
    return seedUsers
  }

  const users = JSON.parse(storedUsers)
    .filter((user) => user.role !== 'public')
    .map((user) => ({
      ...user,
      role: user.role === 'ngo' ? ROLES.NGO : user.role,
    }))

  if (JSON.stringify(users) !== storedUsers) {
    writeUsers(users)
  }

  return users
}

const writeUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const createUserId = () => {
  if (crypto.randomUUID) {
    return `usr_${crypto.randomUUID()}`
  }

  return `usr_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export const mockAuthService = {
  tokenKey: TOKEN_KEY,

  async login({ email, password, role }) {
    await delay()

    const normalizedEmail = email.trim().toLowerCase()
    const user = readUsers().find(
      (candidate) =>
        candidate.email === normalizedEmail &&
        candidate.password === password &&
        candidate.role === role,
    )

    if (!user) {
      throw new Error('No mock user matches that email, password, and role.')
    }

    const token = createMockJwt(user)
    localStorage.setItem(TOKEN_KEY, token)

    return { token, user: sanitizeUser(user) }
  },

  async register({ name, email, password, role }) {
    await delay()

    const users = readUsers()
    const normalizedEmail = email.trim().toLowerCase()

    if (users.some((user) => user.email === normalizedEmail)) {
      throw new Error('A mock user with this email already exists.')
    }

    const user = {
      id: createUserId(),
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
    }

    writeUsers([...users, user])

    const token = createMockJwt(user)
    localStorage.setItem(TOKEN_KEY, token)

    return { token, user: sanitizeUser(user) }
  },

  getSession() {
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      return null
    }

    try {
      const [, payload] = token.split('.')
      const decoded = decodeBase64Url(payload)

      if (!decoded?.user || decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem(TOKEN_KEY)
        return null
      }

      if (decoded.user.role === 'public') {
        localStorage.removeItem(TOKEN_KEY)
        return null
      }

      return { token, user: sanitizeUser(decoded.user) }
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      return null
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
  },
}
