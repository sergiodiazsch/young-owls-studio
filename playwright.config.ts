import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/platform",
  fullyParallel: false,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "on",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
  outputDir: "./tests/screenshots",
});
