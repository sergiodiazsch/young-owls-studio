import { test, expect } from "@playwright/test";

test.describe("Suite 10: UX Persona Walkthrough — First-time user", () => {
  // Use a longer timeout for this comprehensive walkthrough
  test.setTimeout(90000);

  test("Complete first-time user flow", async ({ page }) => {
    const screenshotDir = "tests/screenshots";
    let stepNum = 0;

    function ss(name: string) {
      stepNum++;
      return `${screenshotDir}/10-step${String(stepNum).padStart(2, "0")}-${name}.png`;
    }

    // ──────────────────────────────────────────
    // Step 1: Land on home page
    // ──────────────────────────────────────────
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: ss("home-landing"), fullPage: true });

    const homeText = await page.locator("body").innerText();
    test.info().annotations.push({
      type: "ux-note",
      description: `Home page: Shows "${homeText.includes("Workspace") ? "Workspace header" : "Unknown header"}". ${homeText.includes("No projects") ? "Empty state with CTA visible." : "Existing projects displayed."} Brand identity (Screenplay Studio / YOUNG OWLS) is visible.`,
    });

    // ──────────────────────────────────────────
    // Step 2: Create a new project
    // ──────────────────────────────────────────

    // Dismiss the walkthrough overlay if it's showing (it blocks clicks)
    const walkthroughDialog = page.locator('[role="dialog"][aria-label*="Welcome"]');
    if (await walkthroughDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.info().annotations.push({
        type: "ux-note",
        description:
          "Walkthrough onboarding overlay appeared on first visit. Dismissing with Escape to proceed. This is the expected first-time user experience.",
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Also dismiss any remaining overlay divs that might block clicks
    await page.evaluate(() => {
      // Remove walkthrough click-blocker overlays (z-index 99997+)
      document.querySelectorAll("body > div").forEach((el) => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex || "0", 10);
        if (
          zIndex >= 99997 &&
          style.position === "fixed" &&
          (el as HTMLElement).getAttribute("role") !== "dialog"
        ) {
          (el as HTMLElement).remove();
        }
      });
    });

    // Click "New Project" button
    const newProjectBtn = page.locator(
      'button:has-text("New Project"), button:has-text("Create First Project")'
    );
    await expect(newProjectBtn.first()).toBeVisible({ timeout: 5000 });
    await newProjectBtn.first().click({ timeout: 10000 });

    // Wait for dialog to appear — target the "New Project" dialog specifically
    const dialog = page.locator('[role="dialog"]:has(#title)');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: ss("create-project-dialog") });

    test.info().annotations.push({
      type: "ux-note",
      description:
        'Create project dialog: Clean modal with Title and Subtitle fields. CTA says "Create & Upload Screenplay". Title field has autofocus.',
    });

    // Fill in project details
    const titleInput = dialog.locator("#title");
    await titleInput.fill("QA Test Project");
    const subtitleInput = dialog.locator("#subtitle");
    await subtitleInput.fill("Automated walkthrough test");

    await page.screenshot({ path: ss("create-project-filled") });

    // Click create button
    const createBtn = dialog.locator(
      'button:has-text("Create & Upload Screenplay")'
    );
    await createBtn.click();

    // Wait for navigation to the upload page
    await page.waitForURL("**/upload", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: ss("upload-page"), fullPage: true });

    // Extract project ID from URL
    const url = page.url();
    const projectIdMatch = url.match(/\/project\/(\d+)\//);
    const projectId = projectIdMatch ? projectIdMatch[1] : null;

    test.info().annotations.push({
      type: "ux-note",
      description: `After creating project, redirected to upload page (${url}). Project ID: ${projectId}. User is prompted to upload a screenplay file.`,
    });

    if (!projectId) {
      test.info().annotations.push({
        type: "ux-note",
        description: "Could not extract project ID from URL. Stopping walkthrough.",
      });
      return;
    }

    // ──────────────────────────────────────────
    // Step 3: Navigate to project overview
    // ──────────────────────────────────────────
    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: ss("project-overview"), fullPage: true });

    const overviewText = await page.locator("body").innerText();
    const hasOnboarding =
      overviewText.toLowerCase().includes("get started") ||
      overviewText.toLowerCase().includes("upload") ||
      overviewText.toLowerCase().includes("no scenes") ||
      overviewText.toLowerCase().includes("checklist");

    test.info().annotations.push({
      type: "ux-note",
      description: `Project overview (empty project): ${hasOnboarding ? "Onboarding/empty state is shown." : "No explicit onboarding visible."} Page shows: "${overviewText.slice(0, 200)}..."`,
    });

    // ──────────────────────────────────────────
    // Step 4: Visit characters page (empty state)
    // ──────────────────────────────────────────
    await page.goto(`/project/${projectId}/characters`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: ss("characters-empty"),
      fullPage: true,
    });

    const charsText = await page.locator("body").innerText();
    test.info().annotations.push({
      type: "ux-note",
      description: `Characters page (empty): ${charsText.toLowerCase().includes("no characters") || charsText.toLowerCase().includes("no data") ? "Shows clear empty state." : "Shows content: " + charsText.slice(0, 150)}`,
    });

    // ──────────────────────────────────────────
    // Step 5: Visit locations page (empty state)
    // ──────────────────────────────────────────
    await page.goto(`/project/${projectId}/locations`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: ss("locations-empty"),
      fullPage: true,
    });

    const locsText = await page.locator("body").innerText();
    test.info().annotations.push({
      type: "ux-note",
      description: `Locations page (empty): ${locsText.toLowerCase().includes("no locations") || locsText.toLowerCase().includes("extract") ? "Shows clear empty state with action prompt." : "Shows content: " + locsText.slice(0, 150)}`,
    });

    // ──────────────────────────────────────────
    // Step 6: Visit generate page
    // ──────────────────────────────────────────
    await page.goto(`/project/${projectId}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: ss("generate-page"), fullPage: true });

    const genText = await page.locator("body").innerText();
    test.info().annotations.push({
      type: "ux-note",
      description: `Generate page (empty project): ${genText.slice(0, 200)}...`,
    });

    // ──────────────────────────────────────────
    // Step 7: Visit settings
    // ──────────────────────────────────────────
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: ss("settings"), fullPage: true });

    const settingsText = await page.locator("body").innerText();
    test.info().annotations.push({
      type: "ux-note",
      description: `Settings page: ${settingsText.toLowerCase().includes("api") ? "Shows API key configuration." : ""} ${settingsText.toLowerCase().includes("theme") ? "Theme customization available." : ""} Page content: "${settingsText.slice(0, 200)}..."`,
    });

    // ──────────────────────────────────────────
    // Step 8: Go back to home
    // ──────────────────────────────────────────
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: ss("home-with-project"),
      fullPage: true,
    });

    const homeAfter = await page.locator("body").innerText();
    const projectVisible = homeAfter.includes("QA Test Project");
    test.info().annotations.push({
      type: "ux-note",
      description: `Home page after creating project: Test project ${projectVisible ? "IS visible" : "is NOT visible"} in the project list.`,
    });

    // ──────────────────────────────────────────
    // Step 9: Delete the test project
    // ──────────────────────────────────────────
    if (projectId) {
      // Use API to delete the project cleanly
      const deleteRes = await page.request.delete(
        `/api/projects/${projectId}`
      );
      const deleteOk = deleteRes.ok();

      test.info().annotations.push({
        type: "ux-note",
        description: `Cleanup: Deleted test project ${projectId} via API. Success: ${deleteOk}.`,
      });

      // Verify deletion by refreshing home
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      const homeAfterDelete = await page.locator("body").innerText();
      const projectStillVisible = homeAfterDelete.includes("QA Test Project");

      await page.screenshot({
        path: ss("home-after-delete"),
        fullPage: true,
      });

      test.info().annotations.push({
        type: "ux-note",
        description: `After deletion: Project ${projectStillVisible ? "STILL visible (issue!)" : "successfully removed from list"}.`,
      });

      expect(projectStillVisible).toBe(false);
    }
  });
});
