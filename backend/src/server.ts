import { createApp } from './app.js';
import { existsSync } from 'node:fs';
import { repositoryFromEnvironment } from './config.js';
import {createSupabaseApp,supabaseWebConfiguration} from './supabase-app.js';
import {CpuWorker,cpuConfiguration} from './cpu/worker.js';
import {runtimeConfiguration} from './runtime-config.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const {port,host,production}=runtimeConfiguration();
const remote=process.env.ARENA_STORAGE==='supabase';
const repository = remote?undefined:repositoryFromEnvironment();
const cpu=remote&&process.env.CPU_DB_PASSWORD?new CpuWorker(cpuConfiguration()):undefined;
const application=remote?createSupabaseApp(supabaseWebConfiguration(),cpu):createApp(repository);
const server = application.listen(port, host, () => {
  const storage = remote?'Supabase TrucoOnline':repository?.storage === 'mariadb' ? 'MariaDB truco_arena_dev, implementación provisional' : 'memoria temporal';
  console.log(JSON.stringify({event:'api.started',port,host,storage,production}));
  cpu?.start();
});
let closing = false;
async function closeRepository(): Promise<void> {
  try { await cpu?.close();await repository?.close?.(); }
  catch { console.error('No se pudo cerrar el acceso de persistencia.'); process.exitCode = 1; }
}
server.on('error', error => {
  console.error(`No se pudo iniciar la API: ${error.message}`);
  process.exitCode = 1;
  void closeRepository();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (closing) return;
  closing = true;
  const force=setTimeout(()=>{console.error(JSON.stringify({event:'api.shutdown_timeout'}));process.exit(1);},20000);force.unref();
  server.close(() => { void closeRepository().finally(()=>clearTimeout(force)); });
  server.closeIdleConnections();
});
