import type { PoolOptions } from 'mysql2/promise';
import { DemoRepository } from './demo/demo-repository.js';
import { MariaDbRepository } from './repositories/mariadb-repository.js';
import type { ArenaRepository } from './repositories/arena-repository.js';

export const DEVELOPMENT_DATABASE = 'truco_arena_dev';

export function mariaDbConfiguration(env: NodeJS.ProcessEnv = process.env): PoolOptions {
  const database = env.DB_NAME ?? DEVELOPMENT_DATABASE;
  if (database !== DEVELOPMENT_DATABASE) throw new Error('DB_NAME debe ser exactamente truco_arena_dev.');
  const user = env.DB_USER;
  if (!user || user === 'root') throw new Error('DB_USER debe indicar el usuario limitado de Truco Arena, nunca root.');
  if (env.DB_PASSWORD === undefined || env.DB_PASSWORD.length === 0) throw new Error('Falta DB_PASSWORD para el usuario de aplicación.');
  const port = Number(env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT no es válido.');
  return {
    host: env.DB_HOST ?? '127.0.0.1', port, database, user, password: env.DB_PASSWORD,
    waitForConnections: true, connectionLimit: 5, queueLimit: 30,
    charset: 'utf8mb4_bin', timezone: 'Z', dateStrings: true,
    multipleStatements: false, enableKeepAlive: true, connectTimeout: 5000,
  };
}

export function repositoryFromEnvironment(env: NodeJS.ProcessEnv = process.env): ArenaRepository {
  const storage = env.ARENA_STORAGE ?? 'memory';
  if (storage === 'memory') return new DemoRepository();
  if (storage === 'mariadb') return new MariaDbRepository(mariaDbConfiguration(env));
  throw new Error('ARENA_STORAGE debe ser memory o mariadb.');
}
