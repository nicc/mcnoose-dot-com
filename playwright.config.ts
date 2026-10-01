import { defineConfig, devices } from '@playwright/test';

// Tests the built single-file page. Firefox has no mobile emulation, so it gets a narrow desktop viewport.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'mobile-chrome', use: devices['Pixel 7'] },
    { name: 'mobile-safari', use: devices['iPhone 15'] },
    { name: 'firefox-narrow', use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 } } },
  ],
});
