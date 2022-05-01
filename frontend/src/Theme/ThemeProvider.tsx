import {createContext, ReactNode, useContext, useEffect, useMemo, useState} from 'react';
import rgba from 'color-normalize';

type ColorTree = string | { [key: string]: ColorTree };

export type ThemeStyles = {
    colors: {
        [key: string]: ColorTree;
    }
};

export type ThemeCollection = {
    dark: ThemeStyles;
    light: ThemeStyles;
    [key: string]: ThemeStyles;
};


type ThemeContextState = {
    theme?: string;
    setTheme: (theme: string, transitionTime?: number) => void;
    currentStyles?: ThemeStyles;
    setCurrentStyles: (theme: ThemeStyles, transitionTime?: number) => void;
};

const ThemeContext = createContext<ThemeContextState>({} as ThemeContextState);

type ThemeProviderProps = {
    themeCollection: ThemeCollection;
    initialTheme?: string;
    defaultTransitionTime?: number;
    children: ReactNode;
}

export function ThemeProvider(props: ThemeProviderProps) {
    const [theme, setThemeActual] = useState<string>();
    const [currentStyles, setCurrentStylesActual] = useState<{ styles: ThemeStyles, transitionTime: number }>();

    useEffect(() => {
        // Restore theme and styles from localStorage
        let { theme, styles } = restoreTheme();

        if (!theme) {
            theme = props.initialTheme || 'light';
        }

        if (theme) {
            setThemeActual(theme);
        }

        // Don't override predefined themes
        if (props.themeCollection[theme]) {
            styles = props.themeCollection[theme];
        }

        setCurrentStylesActual({styles, transitionTime: 0});
    }, [props.themeCollection, props.initialTheme]);

    const stylesheet = useMemo(() => {
        const head = document.head || document.getElementsByTagName('head')[0];
        const style = document.createElement('style');
        head.appendChild(style);
        style.appendChild(document.createTextNode(''))
        return style;
    }, []);

    const {setTheme, setCurrentStyles} = useMemo(() => {
        const setTheme = (newTheme: string, transitionTime?: number) => {
            setThemeActual(newTheme);

            if (props.themeCollection[newTheme]) {
                setCurrentStyles(props.themeCollection[newTheme], transitionTime);
            }
        };

        const setCurrentStyles = (styles: ThemeStyles, transitionTime?: number) => {
            if (!transitionTime) {
                transitionTime = props.defaultTransitionTime || 300;
            }
            setCurrentStylesActual({ styles, transitionTime });
        };

        return { setTheme, setCurrentStyles };
    }, [props.defaultTransitionTime, props.themeCollection]);

    useEffect(() => {
        if (theme) {
            if (props.themeCollection[theme]) {
                storeTheme(theme);
            }
            else if (currentStyles) {
                storeTheme(theme, currentStyles.styles);
            }
        }
    }, [props.themeCollection, theme, currentStyles])

    useEffect(() => {
        if (!currentStyles) {
            return;
        }

        // gather colors transition information
        const transition = gatherColorsTransition(currentStyles.styles);

        // apply smooth color transition
        // and return cancel function to prevent multiple simultaneous transitions
        return applyColorsTransition(stylesheet, transition, currentStyles.transitionTime, 10);
    }, [currentStyles, stylesheet]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, currentStyles: currentStyles?.styles, setCurrentStyles }}>
            {props.children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    return useContext(ThemeContext);
}

function restoreTheme() {
    const storedStyles = localStorage.getItem('theme');
    if (!storedStyles) {
        return { theme: undefined, styles: undefined };
    }

    try {
        const result = JSON.parse(storedStyles);
        return { theme: result.theme, styles: result.styles };
    }
    catch {
        return { theme: undefined, styles: undefined };
    }
}

function storeTheme(theme: string, styles?: ThemeStyles) {
    localStorage.setItem('theme', JSON.stringify({
        theme,
        styles
    }));
}

type ColorsTransition = {
    [key: string]: {
        from: string;
        fromRGB: number[];
        to: string;
        toRGB: number[];
    }
}

function gatherColorsTransition(toStyle: ThemeStyles): ColorsTransition {
    const transition: ColorsTransition = {};

    const colors: Record<string, string> = {};
    const colorFlattener = (key: string, color: ColorTree) => {
        if (typeof color === 'string') {
            colors[key] = color;
            return;
        }
        for (const name in color) {
            if (!color.hasOwnProperty(name)) {
                continue;
            }
            colorFlattener(`${key}-${name}`, color[name]);
        }
    }
    colorFlattener('-', toStyle.colors);

    for (const name in colors) {
        if (!colors.hasOwnProperty(name)) {
            continue;
        }
        const to = colors[name];
        const from = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffffff';
        const toRGB = rgba(to);
        const fromRGB = rgba(from);

        transition[name] = { from, fromRGB, to, toRGB };
    }

    return transition;
}

function applyColorsTransition(stylesheet: HTMLStyleElement, transition: ColorsTransition, transitionTime: number, transitionStepInterval: number) {
    const applyColors = (step: number) => {
        let css = ':root {\n';
        for (const color in transition) {
            if (!transition.hasOwnProperty(color)) {
                continue;
            }
            let value;

            if (step >= 1) {
                // use raw color on final step
                value = transition[color].to;
            }
            else {
                // calculate blended rgb value
                const blended = blendValues(transition[color].fromRGB, transition[color].toRGB, step);
                value = `rgba(${Math.floor(blended[0] * 255)}, ${Math.floor(blended[1] * 255)}, ${Math.floor(blended[2] * 255)}, ${blended[3]})`;
            }

            // document.documentElement.style.setProperty('--' + color, value);
            css += `  ${color}: ${value};\n`;
        }
        css += '}\n';

        stylesheet.innerHTML = css;
    }

    if (!transitionTime) {
        // apply final colors if transitionTime is zero
        applyColors(1);
        return () => {};
    }

    const transitionStep = transitionStepInterval / transitionTime;
    let step = 0;
    const updateInterval = setInterval(() => {
        if (step >= 1) {
            clearInterval(updateInterval);
            step = 1;
        }

        applyColors(step);
        step += transitionStep;
    }, transitionStepInterval);

    return () => {
        clearInterval(updateInterval);
    }
}

function blendValues(c1: number[], c2: number[], balance: number) {
    const bal = Math.min(Math.max(balance,0),1);
    const nBal = 1 - bal;
    return [
        c1[0] * nBal + c2[0] * bal,
        c1[1] * nBal + c2[1] * bal,
        c1[2] * nBal + c2[2] * bal,
        c1[3] * nBal + c2[3] * bal,
    ];
}
