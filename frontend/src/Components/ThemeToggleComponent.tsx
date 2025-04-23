import React, { useEffect, useState } from 'react'

import Button from '@ui/Button'

import { useTheme } from '../Theme/ThemeProvider'

import { ReactComponent as DarkIcon } from '../Assets/theme_dark.svg'
import { ReactComponent as LightIcon } from '../Assets/theme_light.svg'

interface ThemeToggleComponentProps {
  buttonLabel?: string
  resetOnOnmount?: boolean
  dynamic?: boolean
}

export default function ThemeToggleComponent({ buttonLabel, resetOnOnmount, dynamic }: ThemeToggleComponentProps) {
  const { theme, setTheme } = useTheme()
  const [initialTheme] = useState(theme)

  useEffect(() => {
    if (theme) {
      return () => {
        if (resetOnOnmount) {
          setTheme(initialTheme || 'light')
        }
      }
    }
  }, [])

  const toggleTheme = (e: React.MouseEvent | null, resetToTheme?: string) => {
    if (e) {
      e.preventDefault()
    }
    if (resetToTheme) {
      setTheme(resetToTheme)
      return
    }
    if (theme === 'dark') {
      setTheme('light')
    } else {
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        if (theme === 'light') {
          setTheme('debugTheme')
          return
        }
      }
      setTheme('dark')
    }
  }

  return (
    <Button variant={dynamic ? 'solid' : 'minimal'} onClick={toggleTheme}>
      {theme === 'dark' ? <LightIcon /> : <DarkIcon />} {buttonLabel ? buttonLabel : ''}
    </Button>
  )
}
