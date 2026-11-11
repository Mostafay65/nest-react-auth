import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read from disk: Vitest blanks CSS imports, `?raw` included, unless CSS processing is on.
const tokensCss = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

type Palette = Record<string, string>;

/** Reads the `--name: #rrggbb` colour tokens in a piece of CSS. */
const colours = (block: string): Palette =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map(([, name = '', hex = '']) => [
      name,
      hex,
    ]),
  );

/**
 * Splits tokens.css into its three blocks: the light theme, the dark theme for
 * a device set to dark, and the same dark theme for a user who picked it.
 */
function readBlocks(css: string): { light: Palette; deviceDark: Palette; pickedDark: Palette } {
  const deviceStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const pickedStart = css.indexOf(":root[data-theme='dark']");
  if (deviceStart < 0 || pickedStart < deviceStart) {
    throw new Error('tokens.css no longer has the light, device-dark and picked-dark blocks');
  }
  return {
    light: colours(css.slice(0, deviceStart)),
    deviceDark: colours(css.slice(deviceStart, pickedStart)),
    pickedDark: colours(css.slice(pickedStart)),
  };
}

/** WCAG 2.2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** Every colour pair the interface uses, and the WCAG AA minimum it must meet. */
const PAIRS = [
  { text: 'ink', on: 'paper', minimum: 4.5, use: 'body text' },
  { text: 'ink-muted', on: 'paper', minimum: 4.5, use: 'labels and secondary text' },
  { text: 'accent', on: 'paper', minimum: 4.5, use: 'error messages and the active index' },
  { text: 'on-ink', on: 'ink', minimum: 4.5, use: 'the solid button label' },
  { text: 'field-rule', on: 'paper', minimum: 3, use: 'input underlines (a control boundary)' },
] as const;

const blocks = readBlocks(tokensCss);
const palettes = { light: blocks.light, dark: { ...blocks.light, ...blocks.deviceDark } };

it('gives the same dark theme whether the device or the user picks it', () => {
  expect(blocks.pickedDark).toEqual(blocks.deviceDark);
});

describe.each(Object.entries(palettes))('the %s theme', (_theme, palette) => {
  it.each(PAIRS)('gives $use at least $minimum:1 contrast', ({ text, on, minimum }) => {
    const foreground = palette[text];
    const background = palette[on];

    expect(foreground, `--${text} is defined`).toBeDefined();
    expect(background, `--${on} is defined`).toBeDefined();
    expect(contrast(foreground ?? '', background ?? '')).toBeGreaterThanOrEqual(minimum);
  });
});
