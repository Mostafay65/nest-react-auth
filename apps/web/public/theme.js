// Applies the theme the user picked before the page is first drawn, so it never
// flashes the other one. It runs from <head>, as a file of its own because the
// CSP allows no inline scripts. The key and values match src/shared/theme.ts.
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  }
} catch {
  // Storage can be blocked, in a private window for example: the page then follows the device.
}
