import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
  },
  webServer: {
    command: 'npm run dev',
    env: {
      ...process.env,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-secret',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      TOKEN_ENCRYPTION_KEY_BASE64:
        process.env.TOKEN_ENCRYPTION_KEY_BASE64 || 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=',
      EXCEL_PROXY_PATH: process.env.EXCEL_PROXY_PATH || '../../Kev Ultimate Comeback.xlsx',
      DATA_BACKEND: process.env.DATA_BACKEND || 'excel'
    },
    port: 3000,
    timeout: 120000,
    reuseExistingServer: false
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
