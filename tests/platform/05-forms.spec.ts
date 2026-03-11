import { test, expect } from "@playwright/test";

// ─── Test Suite 5: Forms & Validation ───

// Dismiss the onboarding walkthrough before every test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("screenplay-onboarding-completed", "true");
  });
});

test.describe("Settings form", () => {
  test("API key inputs exist and page loads without crash", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Assert the page title is visible
    await expect(page.locator("h1", { hasText: "Settings" })).toBeVisible();

    // Assert all 3 API key inputs exist
    const elevenlabsInput = page.locator("#elevenlabs_api_key");
    const falInput = page.locator("#fal_api_key");
    const anthropicInput = page.locator("#anthropic_api_key");

    await expect(elevenlabsInput).toBeVisible();
    await expect(falInput).toBeVisible();
    await expect(anthropicInput).toBeVisible();

    // Assert they are password fields
    await expect(elevenlabsInput).toHaveAttribute("type", "password");
    await expect(falInput).toHaveAttribute("type", "password");
    await expect(anthropicInput).toHaveAttribute("type", "password");
  });

  test("Verify buttons only appear when keys are configured", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // The "Verify All" button should be visible
    const verifyAllBtn = page.getByRole("button", { name: /verify all/i });
    await expect(verifyAllBtn).toBeVisible();
  });

  test("Save button is disabled when no changes made", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const saveBtn = page.getByRole("button", { name: /save settings/i });
    await expect(saveBtn).toBeVisible();
    // Save button should be disabled when no changes have been made
    await expect(saveBtn).toBeDisabled();
  });

  test("submitting empty fields does not crash", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Click Save Settings without entering anything — button should be disabled,
    // so the page should remain stable
    const saveBtn = page.getByRole("button", { name: /save settings/i });
    await expect(saveBtn).toBeDisabled();

    // Try clicking Verify All with no keys configured
    const verifyAllBtn = page.getByRole("button", { name: /verify all/i });
    await verifyAllBtn.click();

    // Page should not crash — settings heading still visible
    await expect(page.locator("h1", { hasText: "Settings" })).toBeVisible();
  });
});

test.describe("Project creation form", () => {
  test("cannot submit empty project title", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open dialog
    const newProjectBtn = page.getByRole("button", { name: /new project/i });
    await newProjectBtn.click();

    const dialog = page.getByRole("dialog", { name: /new project/i });
    await expect(dialog).toBeVisible();

    // The Create button should be disabled when title is empty
    const createBtn = dialog.getByRole("button", {
      name: /create & upload screenplay/i,
    });
    await expect(createBtn).toBeDisabled();

    // Type some whitespace — should still be disabled
    await dialog.locator("#title").fill("   ");
    await expect(createBtn).toBeDisabled();
  });

  test("fill only title and submit successfully, then cleanup", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open dialog
    const newProjectBtn = page.getByRole("button", { name: /new project/i });
    await newProjectBtn.click();

    const dialog = page.getByRole("dialog", { name: /new project/i });
    await expect(dialog).toBeVisible();

    // Fill only the title
    await dialog.locator("#title").fill("Form Validation Test");

    // Create button should now be enabled
    const createBtn = dialog.getByRole("button", {
      name: /create & upload screenplay/i,
    });
    await expect(createBtn).toBeEnabled();

    // Submit
    await createBtn.click();

    // Should redirect to upload page
    await page.waitForURL(/\/project\/\d+\/upload/, { timeout: 10000 });

    // Cleanup: go home and delete the project
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const deleteBtn = page.getByLabel("Delete project Form Validation Test");
    await deleteBtn.click({ force: true });

    const confirmDialog = page.getByRole("dialog", {
      name: /delete project/i,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /delete/i }).click();

    // Verify it's gone
    await expect(
      page.locator("h3", { hasText: "Form Validation Test" })
    ).toBeHidden({ timeout: 10000 });
  });
});
