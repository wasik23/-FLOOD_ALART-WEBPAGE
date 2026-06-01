export const ROLES = {
  VOLUNTEER: 'volunteer',
  NGO: 'coordinator',
  ADMIN: 'admin',
}

export const ROLE_OPTIONS = [
  { value: ROLES.VOLUNTEER, label: 'Volunteer' },
  { value: ROLES.NGO, label: 'NGO/Coordinator' },
  { value: ROLES.ADMIN, label: 'Admin' },
]

export const ROLE_LABELS = ROLE_OPTIONS.reduce((labels, role) => {
  labels[role.value] = role.label
  return labels
}, {})

export const ROLE_HOME_PATHS = {
  [ROLES.VOLUNTEER]: '/volunteer',
  [ROLES.NGO]: '/coordinator',
  [ROLES.ADMIN]: '/admin',
}
