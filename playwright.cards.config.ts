import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const installedChannel = existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
  ? 'chrome' : existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? 'msedge' : undefined;

export default defineConfig({
  testDir: './tests/card-art',
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: 'list',
  outputDir: 'tmp/playwright-card-art-results',
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_CHANNEL ?? installedChannel,
    baseURL: 'http://127.0.0.1:5373',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node node_modules/tsx/dist/cli.mjs backend/src/server.ts', env: { ARENA_STORAGE: 'memory', PORT: '4200' }, url: 'http://127.0.0.1:4200/api/health', reuseExistingServer: false, timeout: 30_000 },
    { command: 'node node_modules/vite/bin/vite.js frontend --config frontend/vite.config.ts --port 5373', env: { API_PROXY_TARGET: 'http://127.0.0.1:4200' }, url: 'http://127.0.0.1:5373/api/health', reuseExistingServer: false, timeout: 30_000 },
  ],
});
