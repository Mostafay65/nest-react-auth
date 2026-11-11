/** The theme the user picked. "auto" follows the device's light or dark setting. */
export type Theme = 'auto' | 'light' | 'dark';

/** Where the pick is kept. public/theme.js reads it before the first paint. */
export const THEME_STORAGE_KEY = 'theme';

/** The order the theme button goes through. */
export const NEXT_THEME: Readonly<Record<Theme, Theme>> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

/** The theme on the page now, as public/theme.js or an earlier pick left it. */
export function currentTheme(): Theme {
  const picked = document.documentElement.dataset.theme;
  return picked === 'light' || picked === 'dark' ? picked : 'auto';
}

/** Shows the page in a theme, and remembers the pick in this browser. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;

  try {
    if (theme === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked, in a private window for example: the pick then lasts until the page closes.
  }
}
