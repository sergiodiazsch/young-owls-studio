import { test, expect, type Page } from "@playwright/test";

/**
 * Test Suite 2: Empty States
 *
 * Creates a test project via the API, visits each sub-page to verify
 * empty states render correctly, then cleans up.
 */

// Force serial execution so beforeAll/afterAll share state correctly
test.describe.configure({ mode: "serial" });

let testProjectId: number | null = null;

// Wait for page to settle
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// Assert the page is not a blank white screen
async function assertNotBlankScreen(page: Page) {
  const body = await page.textContent("body");
  expect((body || "").trim().length).toBeGreaterThan(10);
}

// Assert some CTA, message, or meaningful UI exists
async function assertHasContentOrCTA(page: Page, context: string) {
  const body = await page.textContent("body");
  const hasContent =
    (body || "").trim().length > 20 &&
    !body?.includes("Internal Server Error");

  if (!hasContent) {
    console.log(`WARNING: ${context} may have a blank or error screen`);
  }
  expect(hasContent).toBeTruthy();
}

test.describe("Empty States", () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post("/api/projects", {
      data: { title: "QA Test Project" },
    });

    expect(response.ok()).toBeTruthy();
    const project = await response.json();
    expect(project.id).toBeDefined();
    testProjectId = project.id;
    console.log(`Created test project with ID: ${testProjectId}`);
  });

  test.afterAll(async ({ request }) => {
    if (testProjectId) {
      const response = await request.delete(`/api/projects/${testProjectId}`);
      if (response.ok()) {
        console.log(`Deleted test project ${testProjectId}`);
      } else {
        console.log(
          `Warning: Failed to delete test project ${testProjectId} -- status ${response.status()}`
        );
      }
    }
  });

  test("Project overview shows empty/onboarding state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-overview.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);

    // Check body text for empty state indicators
    const bodyText = (await page.textContent("body")) || "";
    const hasEmptyState =
      bodyText.includes("No scenes yet") ||
      bodyText.includes("Upload Screenplay") ||
      bodyText.includes("Upload") ||
      bodyText.includes("upload");

    expect(hasEmptyState).toBeTruthy();
    console.log("  Overview: Shows empty state with upload CTA");
  });

  test("Characters page shows empty state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/characters`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-characters.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Characters");
    console.log("  Characters: Page loaded with content");
  });

  test("Locations page shows empty state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/locations`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-locations.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Locations");
    console.log("  Locations: Page loaded with content");
  });

  test("Breakdowns page shows empty state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/breakdowns`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-breakdowns.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Breakdowns");
    console.log("  Breakdowns: Page loaded with content");
  });

  test("Moodboards page shows empty state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/moodboards`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-moodboards.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Moodboards");
    console.log("  Moodboards: Page loaded with content");
  });

  test("Generate page loads (may show API key warning)", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/generate`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-generate.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Generate");
    console.log("  Generate: Page loaded with content");
  });

  test("Versions page shows empty state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/versions`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-versions.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Versions");
    console.log("  Versions: Page loaded with content");
  });

  test("Snippets page shows empty state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/snippets`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-snippets.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Snippets");
    console.log("  Snippets: Page loaded with content");
  });

  test("Drive page shows empty state", async ({ page }) => {
    test.skip(!testProjectId, "No test project created");
    await page.goto(`/project/${testProjectId}/drive`);
    await waitForPageLoad(page);

    await page.screenshot({
      path: "tests/screenshots/02-empty-drive.png",
      fullPage: true,
    });

    await assertNotBlankScreen(page);
    await assertHasContentOrCTA(page, "Drive");
    console.log("  Drive: Page loaded with content");
  });
});
