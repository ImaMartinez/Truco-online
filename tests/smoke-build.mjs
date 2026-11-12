import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
async function freePort() {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

const backendPort = await freePort();
const frontendPort = await freePort();
const api = `http://127.0.0.1:${backendPort}`;
const web = `http://127.0.0.1:${frontendPort}`;
const logs = [];
const children = [
  spawn(process.execPath, ['dist/backend/src/server.js'], {
    cwd: resolve(root, 'backend'), env: { ...process.env, PORT: String(backendPort) }, windowsHide: true,
  }),
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
    cwd: resolve(root, 'frontend'), env: { ...process.env, API_PROXY_TARGET: api }, windowsHide: true,
  }),
];
for (const child of children) {
  child.stdout.on('data', data => logs.push(data.toString()));
  child.stderr.on('data', data => logs.push(data.toString()));
  child.on('error', error => logs.push(error.message));
}
try {
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (children.some(child => child.exitCode !== null)) throw new Error(logs.join('\n'));
    try {
      const response = await fetch(`${web}/api/health`);
      if (response.ok) { healthy = true; break; }
    } catch { /* Servers may still be binding their ephemeral ports. */ }
    await delay(200);
  }
  assert(healthy, logs.join('\n'));
  const health = await (await fetch(`${web}/api/health`)).json();
  assert.equal(health.database, 'not-connected');
  const html = await (await fetch(web)).text();
  assert.match(html, /Truco Arena/);
  const script = html.match(/src="([^"]+\.js)"/);
  assert(script, 'El HTML debe referenciar el bundle compilado.');
  assert.equal((await fetch(new URL(script[1], web))).status, 200);
  const catalog = await (await fetch(`${web}/api/catalog`)).json();
  assert.equal(catalog.cards.length, 40);
  console.log('Build verificado: backend compilado + frontend dist + proxy /api + 40 cartas. Sin SQL.');
} finally {
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
