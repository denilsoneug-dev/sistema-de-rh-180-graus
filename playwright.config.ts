import { defineConfig } from "@playwright/test";

const bravePath = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    locale: "pt-BR",
    timezoneId: "America/Fortaleza",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: bravePath },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
