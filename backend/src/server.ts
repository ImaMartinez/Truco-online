import { createApp } from './app.js';
import { existsSync } from 'node:fs';
import { repositoryFromEnvironment } from './config.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT debe ser un entero entre 1024 y 65535.');
const repository = repositoryFromEnvironment();
const server = createApp(repository).listen(port, '127.0.0.1', () => {
  const storage = repository.storage === 'mariadb' ? 'MariaDB truco_arena_dev, implementación provisional' : 'memoria temporal';
  console.log(`Truco Arena API: http://localhost:${port}/api/health — ${storage}; B1–B4 pendientes.`);
});
let closing = false;
async function closeRepository(): Promise<void> {
  try { await repository.close?.(); }
  catch { console.error('No se pudo cerrar el pool MariaDB.'); process.exitCode = 1; }
}
server.on('error', error => {
  console.error(`No se pudo iniciar la API: ${error.message}`);
  process.exitCode = 1;
  void closeRepository();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (closing) return;
  closing = true;
  server.close(() => { void closeRepository(); });
});
