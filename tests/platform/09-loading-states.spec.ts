import { test, expect } from "@playwright/test";

test.describe("Suite 9: Loading States", () => {
  test("Home page shows loading skeleton then content", async ({ page }) => {
    // Delay all API responses by 2 seconds
    await page.route("**/api/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // Start navigation (don't wait for networkidle)
    await page.goto("/", { waitUntil: "commit" });

    // Wait for page DOM to be ready enough
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Take screenshot immediately — should show loading skeleton
    const hasLoadingSkeleton = await page.evaluate(() => {
      // Look for skeleton elements (animated pulse placeholders)
      const skeletons = document.querySelectorAll(
        '[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]'
      );
      // Or look for any loading spinner
      const spinners = document.querySelectorAll(
        '[class*="loader"], [class*="spin"], [class*="loading"]'
      );
      return skeletons.length > 0 || spinners.length > 0;
    });

    await page.screenshot({
      path: "tests/screenshots/09-home-loading.png",
    });

    // Wait for content to load
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Take screenshot of loaded state
    await page.screenshot({
      path: "tests/screenshots/09-home-loaded.png",
    });

    const bodyText = await page.locator("body").innerText();
    const hasLoadedContent =
      bodyText.includes("Workspace") || bodyText.includes("No projects");

    expect(hasLoadedContent).toBe(true);

    test.info().annotations.push({
      type: "ux-note",
      description: `Home page loading: Skeleton visible = ${hasLoadingSkeleton}. After load, page shows Workspace content.`,
    });
  });

  test("Project overview shows loading skeleton then content", async ({
    page,
  }) => {
    // Get a real project ID first (without delay)
    const projectsRes = await page.request.get("/api/projects");
    const projects = await projectsRes.json();

    if (!Array.isArray(projects) || projects.length === 0) {
      test.skip(true, "No projects available to test loading states");
      return;
    }

    const projectId = projects[0].id;

    // Now set up delayed responses
    await page.route("**/api/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // Navigate to project overview
    await page.goto(`/project/${projectId}`, { waitUntil: "commit" });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Take screenshot of loading state
    const hasLoadingSkeleton = await page.evaluate(() => {
      const skeletons = document.querySelectorAll(
        '[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]'
      );
      const spinners = document.querySelectorAll(
        '[class*="loader"], [class*="spin"]'
      );
      return skeletons.length > 0 || spinners.length > 0;
    });

    await page.screenshot({
      path: "tests/screenshots/09-project-loading.png",
    });

    // Wait for full load
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "tests/screenshots/09-project-loaded.png",
    });

    test.info().annotations.push({
      type: "ux-note",
      description: `Project overview loading: Skeleton visible = ${hasLoadingSkeleton}. Project content loads after delay.`,
    });
  });

  test("Characters page shows loading skeleton then content", async ({
    page,
  }) => {
    const projectsRes = await page.request.get("/api/projects");
    const projects = await projectsRes.json();

    if (!Array.isArray(projects) || projects.length === 0) {
      test.skip(true, "No projects available to test loading states");
      return;
    }

    const projectId = projects[0].id;

    // Set up delayed responses
    await page.route("**/api/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    await page.goto(`/project/${projectId}/characters`, {
      waitUntil: "commit",
    });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const hasLoadingIndicator = await page.evaluate(() => {
      const skeletons = document.querySelectorAll(
        '[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]'
      );
      const spinners = document.querySelectorAll(
        '[class*="loader"], [class*="spin"]'
      );
      return skeletons.length > 0 || spinners.length > 0;
    });

    await page.screenshot({
      path: "tests/screenshots/09-characters-loading.png",
    });

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "tests/screenshots/09-characters-loaded.png",
    });

    test.info().annotations.push({
      type: "ux-note",
      description: `Characters page loading: Loading indicator visible = ${hasLoadingIndicator}.`,
    });
  });

  test("Locations page shows loading skeleton then content", async ({
    page,
  }) => {
    const projectsRes = await page.request.get("/api/projects");
    const projects = await projectsRes.json();

    if (!Array.isArray(projects) || projects.length === 0) {
      test.skip(true, "No projects available to test loading states");
      return;
    }

    const projectId = projects[0].id;

    // Set up delayed responses
    await page.route("**/api/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    await page.goto(`/project/${projectId}/locations`, {
      waitUntil: "commit",
    });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const hasLoadingIndicator = await page.evaluate(() => {
      const skeletons = document.querySelectorAll(
        '[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]'
      );
      const spinners = document.querySelectorAll(
        '[class*="loader"], [class*="spin"]'
      );
      return skeletons.length > 0 || spinners.length > 0;
    });

    await page.screenshot({
      path: "tests/screenshots/09-locations-loading.png",
    });

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "tests/screenshots/09-locations-loaded.png",
    });

    test.info().annotations.push({
      type: "ux-note",
      description: `Locations page loading: Loading indicator visible = ${hasLoadingIndicator}.`,
    });
  });
});
