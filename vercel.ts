import {makeVercelConfig} from './infrastructure/vercel-config.mjs';
export const config=makeVercelConfig(process.env);
