// Starts the Docker stack: npm run stack:up
//
// The API signs access tokens with JWT_ACCESS_SECRET and refuses to start without
// one. On the first run this script writes a random secret to .env, which Docker
// Compose reads and git ignores, so no secret is ever committed or shared.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const envFile = new URL('../.env', import.meta.url);
const current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';

if (!process.env.JWT_ACCESS_SECRET && !/^JWT_ACCESS_SECRET=\S/m.test(current)) {
  // Start on a new line, even when the file's last line has no line break.
  const separator = current === '' || current.endsWith('\n') ? '' : '\n';
  const secret = randomBytes(48).toString('base64url');
  appendFileSync(envFile, `${separator}JWT_ACCESS_SECRET=${secret}\n`);
  console.log('Wrote a random JWT_ACCESS_SECRET to .env');
}

const compose = spawnSync('docker', ['compose', 'up', '--detach', '--build', '--wait'], {
  stdio: 'inherit',
});
if (compose.error) {
  console.error(
    `Could not run Docker (${compose.error.message}). Is Docker installed and running?`,
  );
}
process.exit(compose.status ?? 1);
