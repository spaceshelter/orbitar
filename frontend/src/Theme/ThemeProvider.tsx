import { createContext, ReactNode, useContext, useEffect, useMemo, useRef } from 'react'

import rgba from 'color-normalize'
import colorspace from 'color-space'
import { observer } from 'mobx-react-lite'

import { useAppState } from '../AppState/AppState'
import { themes } from '../theme'

type ColorTree = string | { [key: string]: ColorTree }

export type ThemeStyles = {
  colors: {
    [key: string]: ColorTree
  }
}

export type ThemeCollection = {
  dark: ThemeStyles
  light: ThemeStyles
  [key: string]: ThemeStyles
}

type ThemeContextState = {
  currentStyles?: ThemeStyles
  setCurrentStyles: (theme: ThemeStyles, withTransition?: boolean) => void
}

const ThemeContext = createContext<ThemeContextState>({} as ThemeContextState)

type ThemeProviderProps = {
  themeCollection: ThemeCollection
  defaultTransitionTime?: number
  children: ReactNode
}

const globalStylesheet = (() => {
  const head = document.head || document.getElementsByTagName('head')[0]
  const style = document.createElement('style')
  head.appendChild(style)
  style.appendChild(document.createTextNode(''))
  return style
})()

//FIXME ThemeProvider looks unnecessary, can be replaced by autorun in AppState
export const ThemeProvider = observer((props: ThemeProviderProps) => {
  const appState = useAppState()
  const [currentStyles, setCurrentStylesActual] = useMemo(() => {
    // Use a ref to track if we're in a transition
    const state = { styles: undefined as ThemeStyles | undefined, withTransition: false }

    const setCurrentStyles = (styles: ThemeStyles, withTransition = true) => {
      state.styles = styles
      state.withTransition = withTransition
      applyTheme(globalStylesheet, styles, withTransition)
    }

    return [state, setCurrentStyles] as const
  }, [])

  // React to theme changes from AppState, with a flag to prevent transition on initial render
  const initialRenderRef = useRef(true)
  useEffect(() => {
    const theme = appState.theme
    if (props.themeCollection[theme]) {
      // Skip transition on initial render to prevent flash
      const withTransition = !initialRenderRef.current
      initialRenderRef.current = false
      setCurrentStylesActual(props.themeCollection[theme], withTransition)
    }
  }, [appState.theme, props.themeCollection, setCurrentStylesActual])

  return (
    <ThemeContext.Provider value={{ currentStyles: currentStyles.styles, setCurrentStyles: setCurrentStylesActual }}>
      <div data-theme={appState.theme}>{props.children}</div>
    </ThemeContext.Provider>
  )
})

export function useTheme() {
  const appState = useAppState()
  const themeContext = useContext(ThemeContext)

  return {
    theme: appState.theme,
    setTheme: appState.setTheme.bind(appState),
    currentStyles: themeContext.currentStyles,
    setCurrentStyles: (theme: ThemeStyles, transitionTime?: number) => {
      // Convert transitionTime (number) to withTransition (boolean)
      themeContext.setCurrentStyles(theme, transitionTime !== undefined)
    },
  }
}

function applyTheme(stylesheet: HTMLStyleElement, toStyle: ThemeStyles, withTransition = false) {
  const colors: Record<string, string> = {}
  const colorFlattener = (key: string, color: ColorTree) => {
    if (typeof color === 'string') {
      colors[key] = color
      return
    }
    for (const name in color) {
      colorFlattener(`${key}-${name}`, color[name])
    }
  }
  colorFlattener('-', toStyle.colors)

  const pseudoClassNames = [':before', ':after', ':root']
  let css = `${pseudoClassNames.join(', ')} {\n`
  Object.keys(colors).forEach((k) => {
    css += `  ${k}: ${colors[k]};\n`
  })
  css += '}\n'

  if (withTransition) {
    const transitionCss = `svg{transition: fill 300ms ease-in-out;}\n*{ transition-duration: 300ms; transition-timing-function: ease-in; transition-property: color, background-color; }\n`
    stylesheet.innerHTML = css + transitionCss
    setTimeout(() => {
      stylesheet.innerHTML = css
    }, 700)
  } else {
    stylesheet.innerHTML = css
  }
}

export const getThemes = () => {
  Object.values(themes).map(preprocessTheme)
  return themes
}

// GENERATE THEME
const preprocessTheme = (theme: ThemeStyles) => {
  const colors = theme.colors

  //detect if this is dark theme or light theme
  const fg = colors.fg as string
  const isDark: boolean = hsl(fg).l > 0.5

  // generate harder versions of foreground color
  colors.fgHardest ??= isDark ? '#fff' : '#000'
  colors.fgHard ??= lerpColor(fg, colors.fgHardest as string, 0.33)
  colors.fgHarder ??= lerpColor(fg, colors.fgHardest as string, 0.66)

  // generate softer versions of foreground color
  colors.fgMedium ??= reduceAlpha(fg, 0.2) //-20% alpha
  colors.fgSoft ??= reduceAlpha(fg, 0.3)
  colors.fgSofter ??= reduceAlpha(fg, 0.4)
  colors.fgSoftest ??= reduceAlpha(fg, 0.5)
  colors.fgGhost ??= reduceAlpha(fg, 0.7)
  colors.fgAlmostInvisible ??= reduceAlpha(fg, 0.9) //-90% alpha

  colors.onAccent ??= '#fff'
  colors.onAccentGhost ??= 'rgba(255,255,255,0.7)'

  // generate primary variants
  colors.primaryHover ??= increaseSaturation(colors.primary as string, 0.75) //+75% saturation
  colors.primaryGhost ??= reduceAlpha(colors.primary as string, 0.7) //-70% alpha
  colors.primaryAlmostInvisible ??= reduceAlpha(colors.primary as string, 0.9) //-90% alpha

  // generate danger variants
  colors.dangerHover ??= increaseSaturation(colors.danger as string, 0.75)
  colors.dangerGhost ??= reduceAlpha(colors.danger as string, 0.7)
  colors.dangerAlmostInvisible ??= reduceAlpha(colors.danger as string, 0.9)

  // generate positive variants
  colors.positiveHover ??= increaseSaturation(colors.positive as string, 0.75)
  colors.positiveGhost ??= reduceAlpha(colors.positive as string, 0.7)
  colors.positiveAlmostInvisible ??= reduceAlpha(colors.positive as string, 0.9)

  // generate link variants
  colors.linkHover ??= increaseSaturation(colors.link as string, 0.75)
  colors.linkGhost ??= reduceAlpha(colors.link as string, 0.7)

  // backgrounds
  const c = isDark ? 1 : 0
  colors.elevated ??= isDark ? lerpColor(colors.bg as string, '#ffffff', 0.03) : '#fff'
  colors.lowered ??= lerpColor(colors.bg as string, '#000000', isDark ? 0.2 : 0.03)
  colors.dim1 ??= rgbaToString([c, c, c, 0.02])
  colors.dim2 ??= rgbaToString([c, c, c, 0.04])
  colors.dim3 ??= rgbaToString([c, c, c, 0.06])
}

const reduceAlpha = (c: string, r: number): string => {
  const [red, g, b, a] = rgba(c)
  return rgbaToString([red, g, b, lerp(a, 0, r)])
}

const increaseSaturation = (c: string, r: number): string => {
  const p = hsl(c)
  p.s = lerp(p.s, 1, r)
  return HSLtoRGBString(p)
}

const lerp = (a: number, b: number, r: number) => a + Math.min(Math.max(r, 0), 1) * (b - a)

const lerpColor = (a: string, b: string, r: number) => {
  const c1 = rgba(a)
  const c2 = rgba(b)
  const bal = Math.min(Math.max(r, 0), 1)
  const res = [
    c1[0] + bal * (c2[0] - c1[0]),
    c1[1] + bal * (c2[1] - c1[1]),
    c1[2] + bal * (c2[2] - c1[2]),
    c1[3] + bal * (c2[3] - c1[3]),
  ]
  return rgbaToString(res)
}

const rgbaToString = (color: number[]): string => {
  return `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(color[2] * 255)}, ${color[3].toFixed(2).replace(/\.?0+$/, '')})`
}

type HSL = { h: number; s: number; l: number }
const hsl = (color: string): HSL => {
  const [r, g, b] = rgba(color)
  const hsl = colorspace.rgb.hsl([r * 255, g * 255, b * 255])
  return { h: hsl[0] / 360, s: hsl[1] / 100, l: hsl[2] / 100 }
}

const HSLtoRGBString = (c: HSL): string => {
  const rgb = colorspace.hsl.rgb([c.h * 360, c.s * 100, c.l * 100])
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}
