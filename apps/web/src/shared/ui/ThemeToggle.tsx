import { useState } from 'react';
import { applyTheme, currentTheme, NEXT_THEME, type Theme } from '../theme';
import { cx } from './cx';
import styles from './ThemeToggle.module.css';

const NAMES: Readonly<Record<Theme, string>> = { auto: 'Auto', light: 'Light', dark: 'Dark' };

/** Goes from Auto (the device's setting) to Light, to Dark, and back to Auto. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState(currentTheme);

  function pickNext() {
    const next = NEXT_THEME[theme];
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button type="button" className={cx(styles.toggle, className)} onClick={pickNext}>
      Theme: {NAMES[theme]}
    </button>
  );
}
