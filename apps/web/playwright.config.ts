import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Runs against a locally-built app in demo mode (no secrets needed).
 * Run: `pnpm --filter @psr/web exec playwright install chromium` then `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { DATA_MODE: 'demo' },
  },
});
