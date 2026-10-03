import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.CHROMIUM_PATH || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const launch = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', ...launch },
  webServer: { command: 'npx serve out -l 4173', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'iphone-13', use: { ...devices['iPhone 13'], browserName: 'chromium', ...launch } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'], browserName: 'chromium', ...launch } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'], browserName: 'chromium', ...launch } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...launch } },
  ],
});
