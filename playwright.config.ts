import { defineConfig, devices } from "@playwright/test";

const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: remoteBaseUrl ? 120_000 : 60_000,
  expect: { timeout: remoteBaseUrl ? 25_000 : 15_000 },
  outputDir: "test-results",
  reporter: [["list"]],
  use: {
    baseURL: remoteBaseUrl ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
