import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Test Suite 1: Navigation & Route Loading
 *
 * Verifies that all major routes load without errors,
 * handles 404s gracefully, and supports browser navigation.
 */

// Collect console errors during page load
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

// Assert no crash/error screens visible
async function assertNoErrorScreen(page: Page) {
  const bodyText = await page.textContent("body");
  expect(bodyText).not.toContain("Internal Server Error");
}

// Wait for page to settle (no loading skeletons)
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// Dismiss any walkthrough/onboarding overlay if present
async function dismissWalkthrough(page: Page) {
  // The app may show a walkthrough dialog on first visit; try to dismiss it
  const skipButton = page.locator('button:has-text("Skip")').first();
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await page.waitForTimeout(300);
  }
}

test.describe("Navigation & Route Loading", () => {
  test("Home page (/) loads successfully", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/");
    await waitForPageLoad(page);
    await dismissWalkthrough(page);

    // Should show "Workspace" heading (use role selector for specificity)
    await expect(
      page.getByRole("heading", { name: "Workspace" })
    ).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "tests/screenshots/01-home.png", fullPage: true });
    await assertNoErrorScreen(page);

    // Filter out noisy/expected console errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("Hydration") &&
        !e.includes("downloadable font") &&
        !e.includes("third-party cookie")
    );
    if (realErrors.length > 0) {
      console.log("Console errors on /:", realErrors);
    }
  });

  test("Settings page (/settings) loads successfully", async ({ page }) => {
    collectConsoleErrors(page);
    await page.goto("/settings");
    await waitForPageLoad(page);

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "tests/screenshots/01-settings.png", fullPage: true });
    await assertNoErrorScreen(page);
  });

  test("Project page loads if projects exist", async ({ page }) => {
    const response = await page.request.get("/api/projects");
    const projects = await response.json();

    if (!Array.isArray(projects) || projects.length === 0) {
      console.log("No projects found -- skipping project route tests");
      test.skip();
      return;
    }

    const projectId = projects[0].id;
    console.log(`Testing with project ID: ${projectId}`);

    await page.goto(`/project/${projectId}`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/01-project-overview.png",
      fullPage: true,
    });
    await assertNoErrorScreen(page);

    // Should show either project content or empty state -- check body has meaningful text
    const bodyText = (await page.textContent("body")) || "";
    const hasContent =
      bodyText.includes("No scenes yet") ||
      bodyText.includes("Dashboard") ||
      bodyText.includes("Scene Breakdown") ||
      bodyText.includes("Upload Screenplay") ||
      bodyText.includes("Scenes") ||
      bodyText.trim().length > 100;

    expect(hasContent).toBeTruthy();
  });

  test("Project sub-pages load if project exists", async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for 15 sub-pages

    const response = await page.request.get("/api/projects");
    const projects = await response.json();

    if (!Array.isArray(projects) || projects.length === 0) {
      console.log("No projects found -- skipping sub-page tests");
      test.skip();
      return;
    }

    const projectId = projects[0].id;
    const subPages = [
      "characters",
      "locations",
      "breakdowns",
      "moodboards",
      "generate",
      "versions",
      "snippets",
      "drive",
      "scenes",
      "script-doctor",
      "dialogue-polish",
      "audio-studio",
      "video-editor",
      "budget",
      "color-script",
    ];

    for (const sub of subPages) {
      await page.goto(`/project/${projectId}/${sub}`, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await waitForPageLoad(page);

      await page.screenshot({
        path: `tests/screenshots/01-project-${sub}.png`,
        fullPage: true,
      });

      const bodyText = await page.textContent("body");
      expect(bodyText).not.toContain("Internal Server Error");

      console.log(`  /project/${projectId}/${sub} -- loaded OK`);
    }
  });

  test("Non-existent route (/nonexistent) shows 404", async ({ page }) => {
    const resp = await page.goto("/nonexistent");
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/01-404.png",
      fullPage: true,
    });

    const body = await page.textContent("body");
    const is404 =
      body?.includes("404") ||
      body?.includes("not found") ||
      body?.includes("Not Found") ||
      body?.includes("Scene not found") ||
      resp?.status() === 404;

    expect(is404).toBeTruthy();
  });

  test("Non-existent project (/project/99999) handles gracefully", async ({ page }) => {
    await page.goto("/project/99999");
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/01-project-99999.png",
      fullPage: true,
    });

    const bodyText = await page.textContent("body");
    expect(bodyText).not.toContain("Internal Server Error");
    console.log(
      "Non-existent project response: page loaded without hard crash"
    );
  });

  test("Browser back/forward navigation works", async ({ page }) => {
    // Navigate: Home -> Settings -> Back -> Forward
    await page.goto("/");
    await waitForPageLoad(page);
    await dismissWalkthrough(page);
    await expect(
      page.getByRole("heading", { name: "Workspace" })
    ).toBeVisible({ timeout: 10000 });

    await page.goto("/settings");
    await waitForPageLoad(page);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 10000,
    });

    // Go back
    await page.goBack();
    await waitForPageLoad(page);
    await dismissWalkthrough(page);
    await expect(
      page.getByRole("heading", { name: "Workspace" })
    ).toBeVisible({ timeout: 10000 });

    // Go forward
    await page.goForward();
    await waitForPageLoad(page);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({
      path: "tests/screenshots/01-back-forward.png",
      fullPage: true,
    });
  });
});
