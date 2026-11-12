import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
const channel=existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')?'msedge':undefined;
export default defineConfig({
  testDir:'./tests/sql-e2e',workers:1,fullyParallel:false,timeout:45_000,
  reporter:'list',outputDir:'tmp/playwright-sql-results',
  use:{...devices['Desktop Chrome'],channel,baseURL:'http://127.0.0.1:5273',screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:[
    {command:'node --env-file=backend/.env.mariadb backend/dist/backend/src/server.js',env:{PORT:'4100'},url:'http://127.0.0.1:4100/api/health',reuseExistingServer:false,timeout:30_000},
    {command:'node node_modules/vite/bin/vite.js frontend --config frontend/vite.config.ts --port 5273',env:{API_PROXY_TARGET:'http://127.0.0.1:4100'},url:'http://127.0.0.1:5273/api/health',reuseExistingServer:false,timeout:30_000},
  ],
});
