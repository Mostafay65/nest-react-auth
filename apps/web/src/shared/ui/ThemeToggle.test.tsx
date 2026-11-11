import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THEME_STORAGE_KEY } from '../theme';
import { ThemeToggle } from './ThemeToggle';

const root = document.documentElement;
/** The script index.html runs before the app; tested here because it shares the key. */
const startUpScript = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'public', 'theme.js'),
  'utf8',
);
// Runs the file as a classic script, as the browser does.
const runStartUpScript = new Function(startUpScript) as () => void;

afterEach(() => {
  localStorage.clear();
  root.removeAttribute('data-theme');
});

describe('ThemeToggle', () => {
  it('starts on Auto, then goes to Light, Dark and back, remembering each pick', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    expect(screen.getByRole('button')).toHaveAccessibleName('Theme: Auto');
    expect(root).not.toHaveAttribute('data-theme');

    await user.click(screen.getByRole('button', { name: 'Theme: Auto' }));
    expect(screen.getByRole('button')).toHaveAccessibleName('Theme: Light');
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAccessibleName('Theme: Dark');
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAccessibleName('Theme: Auto');
    expect(root).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('shows the theme the start-up script applied', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    runStartUpScript();

    render(<ThemeToggle />);

    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button')).toHaveAccessibleName('Theme: Dark');
  });

  it('still changes the theme when the browser blocks storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Theme: Auto' }));

    expect(root).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button')).toHaveAccessibleName('Theme: Light');
  });
});

describe('the start-up script', () => {
  it.each(['light', 'dark'])('applies a saved "%s"', (theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    runStartUpScript();

    expect(root).toHaveAttribute('data-theme', theme);
  });

  it('ignores anything else, so the page follows the device', () => {
    localStorage.setItem(THEME_STORAGE_KEY, '"><script>');

    runStartUpScript();

    expect(root).not.toHaveAttribute('data-theme');
  });

  it('follows the device when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });

    expect(runStartUpScript).not.toThrow();
    expect(root).not.toHaveAttribute('data-theme');
  });
});
