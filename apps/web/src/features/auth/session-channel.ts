/** What one tab tells the others about the session they share. */
export type SessionEvent = 'signed-in' | 'signed-out';

/**
 * Tabs share the refresh cookie, but each keeps its own session in memory. So
 * a tab announces when it signs in or out, and the other tabs follow. A
 * channel never hears its own messages. Where BroadcastChannel is missing,
 * other tabs only find out on their next refresh or reload.
 */
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('auth');

export function announce(event: SessionEvent): void {
  channel?.postMessage(event);
}

/** Calls `listener` for each event another tab announces. Returns the unsubscribe function. */
export function onAnnouncement(listener: (event: SessionEvent) => void): () => void {
  if (!channel) return () => {};

  const receive = ({ data }: MessageEvent<unknown>) => {
    if (data === 'signed-in' || data === 'signed-out') listener(data);
  };
  channel.addEventListener('message', receive);
  return () => channel.removeEventListener('message', receive);
}
