/**
 * Another tab of the app, as far as the session channel is concerned: what it
 * hears from the tab under test, and a way to announce something to it.
 */
export function otherTab() {
  const channel = new BroadcastChannel('auth');
  const heard: unknown[] = [];
  channel.addEventListener('message', (event) => heard.push(event.data));
  onTestFinished(() => channel.close());

  return {
    heard,
    announce: (message: string) => channel.postMessage(message),
  };
}
