import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { ThemeContext } from './themeContextValue.js'

const bangladeshTheme = {
  colors: {
    primary: '#006A4E',
    accent: '#F42A41',
  },
}

export function ThemeProvider({ children }) {
  const value = useMemo(() => bangladeshTheme, [])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
