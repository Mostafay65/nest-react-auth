/**
 * jsdom has no Web Locks API. This stand-in grants each lock name to one
 * holder at a time, in request order, which is all the session code needs.
 */
export function installWebLocks(): void {
  if ('locks' in navigator) return;

  const tails = new Map<string, Promise<unknown>>();
  const locks = {
    request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      const result = (tails.get(name) ?? Promise.resolve()).then(() => callback());
      tails.set(
        name,
        result.catch(() => undefined),
      );
      return result;
    },
  };

  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
}
