import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { AuthContext } from './authContextValue.js'
import { mockAuthService } from './mockAuthService.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => mockAuthService.getSession())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setSession(mockAuthService.getSession())
    setIsReady(true)
  }, [])

  const login = useCallback(async (credentials) => {
    const nextSession = await mockAuthService.login(credentials)
    setSession(nextSession)
    return nextSession
  }, [])

  const register = useCallback(async (details) => {
    const nextSession = await mockAuthService.register(details)
    setSession(nextSession)
    return nextSession
  }, [])

  const logout = useCallback(() => {
    mockAuthService.logout()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token),
      isReady,
      login,
      logout,
      register,
      token: session?.token ?? null,
      user: session?.user ?? null,
    }),
    [isReady, login, logout, register, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
