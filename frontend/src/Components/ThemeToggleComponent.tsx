import buttonStyles from '../Components/Buttons.module.scss';
import React, {useEffect, useState} from 'react';
import {ReactComponent as DarkIcon} from '../Assets/theme_dark.svg';
import {ReactComponent as LightIcon} from '../Assets/theme_light.svg';
import {useTheme} from '../Theme/ThemeProvider';
import classNames from 'classnames';

interface ThemeToggleComponentProps {
  buttonLabel?: string;
  resetOnOnmount?: boolean;
  dynamic?: boolean;
}

export default function ThemeToggleComponent(props: ThemeToggleComponentProps) {
  const {theme, setTheme} = useTheme();
  const [initialTheme] = useState(theme);

  useEffect(() => {
    if (theme) {
      return () => {
        if (props.resetOnOnmount) {
          setTheme(initialTheme || 'light');
        }
      };
    }
  }, []);

  const toggleTheme = (e: React.MouseEvent | null, resetToTheme?: string) => {
    if (e) {
      e.preventDefault();
    }
    if (resetToTheme) {
      setTheme(resetToTheme);
      return;
    }
    if (theme === 'dark') {
      setTheme('light');
    }
    else {
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        if (theme === 'light') { setTheme('debugTheme'); return;  }
      }
      setTheme('dark');
    }
  };

  return <button
    className={classNames(buttonStyles.themeButton, props.dynamic ? buttonStyles.dynamic : '')}
    onClick={toggleTheme}>{theme === 'dark' ? <LightIcon /> : <DarkIcon />} {props.buttonLabel ? props.buttonLabel : ''}
  </button>;
}
