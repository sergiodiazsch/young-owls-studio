import { test, expect } from "@playwright/test";

// ─── Test Suite 4: CRUD Operations ───

// Dismiss the onboarding walkthrough before every test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("screenplay-onboarding-completed", "true");
  });
});

test.describe("Projects CRUD", () => {
  // Use a unique name per run to avoid collisions with leftover data
  const projectName = `CRUD Test ${Date.now()}`;

  test("create, verify, navigate, delete a project", async ({ page }) => {
    test.setTimeout(60000);

    // 1. Go to home page
    await page.goto("/");
    // Wait for content rather than networkidle to avoid hanging
    await expect(page.locator("h1", { hasText: "Workspace" })).toBeVisible({
      timeout: 15000,
    });

    // 2. Click "New Project" button
    const newProjectBtn = page.getByRole("button", { name: /new project/i });
    await expect(newProjectBtn).toBeVisible();
    await newProjectBtn.click();

    // 3. Fill title in the dialog (use specific dialog name)
    const dialog = page.getByRole("dialog", { name: /new project/i });
    await expect(dialog).toBeVisible();
    const titleInput = dialog.locator("#title");
    await titleInput.fill(projectName);

    // 4. Submit by clicking the create button
    const createBtn = dialog.getByRole("button", {
      name: /create & upload screenplay/i,
    });
    await createBtn.click();

    // After creation, the app redirects to /project/{id}/upload
    await page.waitForURL(/\/project\/\d+\/upload/, { timeout: 15000 });
    const projectUrl = page.url();
    const projectIdMatch = projectUrl.match(/\/project\/(\d+)\//);
    expect(projectIdMatch).toBeTruthy();

    // 5. Navigate back to home and assert project appears in the list
    await page.goto("/");
    await expect(page.locator("h1", { hasText: "Workspace" })).toBeVisible({
      timeout: 15000,
    });
    const projectCard = page.locator("h3", { hasText: projectName });
    await expect(projectCard).toBeVisible({ timeout: 15000 });

    // 6. Navigate to the project by clicking its card
    await projectCard.click();
    await page.waitForURL(/\/project\/\d+/);

    // 7. Go back home to delete
    await page.goto("/");
    await expect(page.locator("h1", { hasText: "Workspace" })).toBeVisible({
      timeout: 15000,
    });
    // Wait for projects list to load
    await expect(
      page.locator("h3", { hasText: projectName })
    ).toBeVisible({ timeout: 15000 });

    // 8. Delete the project — click the delete button (aria-label based)
    const deleteBtn = page.getByLabel(`Delete project ${projectName}`);
    // The delete button is hidden until hover — force click it
    await deleteBtn.click({ force: true });

    // 9. Confirm deletion in the confirm dialog
    const confirmDialog = page.getByRole("dialog", {
      name: /delete project/i,
    });
    await expect(confirmDialog).toBeVisible();
    const confirmBtn = confirmDialog.getByRole("button", {
      name: /delete project/i,
    });
    await confirmBtn.click();

    // 10. Assert project is gone
    await expect(
      page.locator("h3", { hasText: projectName })
    ).toBeHidden({ timeout: 10000 });
  });
});

test.describe("Moodboards CRUD", () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    // Create a project for moodboard tests
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("screenplay-onboarding-completed", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const newProjectBtn = page.getByRole("button", { name: /new project/i });
    await newProjectBtn.click();

    const dialog = page.getByRole("dialog", { name: /new project/i });
    await expect(dialog).toBeVisible();
    await dialog.locator("#title").fill("Moodboard Test Project");

    await dialog
      .getByRole("button", { name: /create & upload screenplay/i })
      .click();
    await page.waitForURL(/\/project\/\d+\/upload/, { timeout: 10000 });

    const idMatch = page.url().match(/\/project\/(\d+)\//);
    projectId = idMatch![1];
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: delete the project
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("screenplay-onboarding-completed", "true");
    });
    try {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const deleteBtn = page.getByLabel(
        "Delete project Moodboard Test Project"
      );
      await deleteBtn.click({ force: true });
      const confirmDialog = page.getByRole("dialog", {
        name: /delete project/i,
      });
      await expect(confirmDialog).toBeVisible();
      await confirmDialog
        .getByRole("button", { name: /delete/i })
        .click();
      await page.waitForTimeout(1000);
    } catch {
      // ignore cleanup errors
    }
    await page.close();
  });

  test("create and delete a moodboard", async ({ page }) => {
    // 1. Navigate to moodboards page
    await page.goto(`/project/${projectId}/moodboards`);
    await page.waitForLoadState("networkidle");

    // 2. Click "New Board" or "Create Your First Board" button
    const newBoardBtn = page.getByRole("button", { name: /new board/i });
    const createFirstBtn = page.getByRole("button", {
      name: /create your first board/i,
    });
    const boardBtn = (await createFirstBtn.isVisible())
      ? createFirstBtn
      : newBoardBtn;
    await boardBtn.click();

    // 3. Fill moodboard title in dialog
    const dialog = page.getByRole("dialog", {
      name: /create new moodboard/i,
    });
    await expect(dialog).toBeVisible();
    await dialog.locator("#moodboard-title").fill("Test Board");
    await dialog.getByRole("button", { name: /create board/i }).click();

    // After creation, the app redirects to the moodboard detail page.
    // The page may be compiling, so wait longer.
    await page.waitForURL(/\/moodboards\/\d+/, { timeout: 30000 });

    // 4. Go back to moodboards list and assert it appears
    await page.goto(`/project/${projectId}/moodboards`);
    await page.waitForLoadState("networkidle");
    const boardCard = page.locator("h3", { hasText: "Test Board" });
    await expect(boardCard).toBeVisible({ timeout: 10000 });

    // 5. Delete the moodboard — hover over card to reveal delete button
    const card = page.locator(".group", { has: boardCard });
    const deleteBtn = card.getByLabel(/delete moodboard/i);
    await deleteBtn.click({ force: true });

    // 6. Confirm deletion
    const confirmDialog = page.getByRole("dialog", {
      name: /delete moodboard/i,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: /delete board/i })
      .click();

    // 7. Assert moodboard is gone
    await expect(
      page.locator("h3", { hasText: "Test Board" })
    ).toBeHidden({ timeout: 10000 });
  });
});

test.describe("Snippets CRUD", () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    // Create a project for snippet tests
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("screenplay-onboarding-completed", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const newProjectBtn = page.getByRole("button", { name: /new project/i });
    await newProjectBtn.click();

    const dialog = page.getByRole("dialog", { name: /new project/i });
    await expect(dialog).toBeVisible();
    await dialog.locator("#title").fill("Snippet Test Project");

    await dialog
      .getByRole("button", { name: /create & upload screenplay/i })
      .click();
    await page.waitForURL(/\/project\/\d+\/upload/, { timeout: 10000 });

    const idMatch = page.url().match(/\/project\/(\d+)\//);
    projectId = idMatch![1];
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: delete the project
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("screenplay-onboarding-completed", "true");
    });
    try {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const deleteBtn = page.getByLabel(
        "Delete project Snippet Test Project"
      );
      await deleteBtn.click({ force: true });
      const confirmDialog = page.getByRole("dialog", {
        name: /delete project/i,
      });
      await expect(confirmDialog).toBeVisible();
      await confirmDialog
        .getByRole("button", { name: /delete/i })
        .click();
      await page.waitForTimeout(1000);
    } catch {
      // ignore cleanup errors
    }
    await page.close();
  });

  test("create and delete a snippet", async ({ page }) => {
    // 1. Navigate to snippets page
    await page.goto(`/project/${projectId}/snippets`);
    await page.waitForLoadState("networkidle");

    // 2. Click "New Snippet" button
    const newSnippetBtn = page.getByRole("button", { name: /new snippet/i });
    const createFirstBtn = page.getByRole("button", {
      name: /create first snippet/i,
    });
    const snippetBtn = (await createFirstBtn.isVisible())
      ? createFirstBtn
      : newSnippetBtn;
    await snippetBtn.click();

    // 3. Fill snippet form
    const dialog = page.getByRole("dialog", { name: /new snippet/i });
    await expect(dialog).toBeVisible();
    await dialog.locator("#snippet-name").fill("Test Snippet");
    await dialog.locator("#snippet-content").fill("cinematic wide shot");
    await dialog
      .getByRole("button", { name: /create snippet/i })
      .click();

    // 4. Wait for dialog to close and snippet to appear
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Reload to see it in the list (onSaved triggers refetch)
    await page.goto(`/project/${projectId}/snippets`);
    await page.waitForLoadState("networkidle");
    const snippetName = page.locator("p.font-semibold", {
      hasText: "Test Snippet",
    });
    await expect(snippetName).toBeVisible({ timeout: 10000 });

    // 5. Delete the snippet — click the delete button on the card
    const snippetCard = page
      .locator(".group", { has: snippetName })
      .first();
    const deleteBtn = snippetCard.getByLabel("Delete snippet");
    await deleteBtn.click({ force: true });

    // 6. Confirm deletion
    const confirmDialog = page.getByRole("dialog", {
      name: /delete snippet/i,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: /^delete$/i })
      .click();

    // 7. Assert snippet is gone
    await expect(
      page.locator("p.font-semibold", { hasText: "Test Snippet" })
    ).toBeHidden({ timeout: 10000 });
  });
});

test.describe("Characters search", () => {
  test("check characters page and test search if characters exist", async ({
    page,
  }) => {
    // First, find an existing project with scenes
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check if any projects exist
    const projectCards = page.locator("[data-tour='project-list'] h3");
    const projectCount = await projectCards.count();

    if (projectCount === 0) {
      test.skip();
      return;
    }

    // Click the first project
    await projectCards.first().click();
    await page.waitForURL(/\/project\/\d+/);

    const idMatch = page.url().match(/\/project\/(\d+)/);
    const projectId = idMatch![1];

    // Navigate to characters page
    await page.goto(`/project/${projectId}/characters`);
    await page.waitForLoadState("networkidle");

    // Check if characters exist by looking for search input
    const searchInput = page.locator('input[placeholder*="earch"]');
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (!hasSearch) {
      // No characters or no search — skip the rest
      return;
    }

    // Look for character name elements
    const characterNames = page.locator("h3");
    const charCount = await characterNames.count();

    if (charCount === 0) {
      return;
    }

    // Get the first character's name
    const firstName = await characterNames.first().textContent();
    if (!firstName) return;

    // Type the character name in search
    await searchInput.fill(firstName.trim().substring(0, 4));
    await page.waitForTimeout(500);

    // Assert the character is still visible (filter works)
    await expect(
      page.locator("text=" + firstName.trim()).first()
    ).toBeVisible();
  });
});
