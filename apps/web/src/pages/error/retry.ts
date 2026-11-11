/**
 * The navigation state "Try again" sets. The page that replaces the error page
 * comes in a new frame, and the button that had focus is gone, so the frame
 * reads this to move focus to the page's heading, as any navigation does.
 */
export const RETRIED = { retried: true } as const;

export const isRetry = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'retried' in state;
