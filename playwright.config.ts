import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const installedChannel = existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
  ? 'chrome' : existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? 'msedge' : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  outputDir: 'tmp/playwright-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL ?? installedChannel } }],
  // Procesos directos para pruebas: sin watcher interactivo ni launcher anidado.
  webServer: [
    { command: 'node node_modules/tsx/dist/cli.mjs backend/src/server.ts', env: { ARENA_STORAGE: 'memory', PORT: '4000' }, url: 'http://127.0.0.1:4000/api/health', reuseExistingServer: !process.env.CI, timeout: 30_000 },
    { command: 'node node_modules/vite/bin/vite.js frontend --config frontend/vite.config.ts --port 5173', env: { API_PROXY_TARGET: 'http://127.0.0.1:4000' }, url: 'http://127.0.0.1:5173/api/health', reuseExistingServer: !process.env.CI, timeout: 30_000 },
  ],
});
