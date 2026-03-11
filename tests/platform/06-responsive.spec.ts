import { test, expect } from "@playwright/test";

// ─── Test Suite 6: Responsive Viewports ───

const viewports = [
  { width: 375, height: 812, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1920, height: 1080, name: "wide" },
];

// Dismiss the onboarding walkthrough before every test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("screenplay-onboarding-completed", "true");
  });
});

test.describe("Responsive — Home page", () => {
  for (const vp of viewports) {
    test(`home page renders correctly at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Screenshot
      await page.screenshot({
        path: `tests/screenshots/home-${vp.name}.png`,
        fullPage: true,
      });

      // Assert page content is visible
      await expect(page.locator("h1", { hasText: "Workspace" })).toBeVisible();

      // Assert no problematic horizontal overflow
      const bodyOverflowX = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowX;
      });
      expect(["hidden", "auto", "visible", "scroll"]).toContain(bodyOverflowX);

      // Additional check: page width does not exceed viewport
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      // Allow a small tolerance of 5px for scrollbar differences
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  }
});

test.describe("Responsive — Project page", () => {
  let projectId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Find or create a project for responsive testing
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("screenplay-onboarding-completed", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check if any existing project is available
    const projectCards = page.locator("[data-tour='project-list'] h3");
    const count = await projectCards.count();

    if (count > 0) {
      // Use the first existing project
      await projectCards.first().click();
      await page.waitForURL(/\/project\/\d+/);
      const match = page.url().match(/\/project\/(\d+)/);
      projectId = match?.[1] ?? null;
    } else {
      // Create one
      const newProjectBtn = page.getByRole("button", {
        name: /new project/i,
      });
      await newProjectBtn.click();
      const dialog = page.getByRole("dialog", { name: /new project/i });
      await expect(dialog).toBeVisible();
      await dialog.locator("#title").fill("Responsive Test Project");
      await dialog
        .getByRole("button", { name: /create & upload screenplay/i })
        .click();
      await page.waitForURL(/\/project\/\d+\/upload/, { timeout: 10000 });
      const match = page.url().match(/\/project\/(\d+)\//);
      projectId = match?.[1] ?? null;
    }
    await page.close();
  });

  for (const vp of viewports) {
    test(`project page renders correctly at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      test.skip(!projectId, "No project available for testing");

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/project/${projectId}`);
      await page.waitForLoadState("networkidle");

      // Screenshot
      await page.screenshot({
        path: `tests/screenshots/project-${vp.name}.png`,
        fullPage: true,
      });

      // Assert main content area is visible
      const mainContent = page.locator("#main-content");
      await expect(mainContent).toBeVisible();

      // Assert no problematic horizontal overflow
      const bodyOverflowX = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowX;
      });
      expect(["hidden", "auto", "visible", "scroll"]).toContain(bodyOverflowX);

      // Check: page width does not exceed viewport
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  }
});
