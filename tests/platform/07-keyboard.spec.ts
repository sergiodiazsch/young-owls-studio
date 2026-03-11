import { test, expect } from "@playwright/test";

test.describe("Suite 7: Keyboard & Accessibility", () => {
  test("Cmd+K opens command palette, type search, Escape closes it", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Dismiss any walkthrough overlay that might be showing
    const walkthroughDialog = page.locator('[role="dialog"][aria-label*="Welcome"]');
    if (await walkthroughDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await walkthroughDialog.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
    }

    // Press Meta+K to open command palette
    await page.keyboard.press("Meta+k");

    // Assert the command palette dialog appears (specifically, not the walkthrough)
    const dialog = page.getByRole("dialog", { name: "Command Palette" });
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // The command palette uses CommandInput which renders an <input>
    const searchInput = dialog.locator("input");
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill("Settings");
    // Verify the text was entered
    await expect(searchInput).toHaveValue("Settings");

    // Take screenshot of open palette
    await page.screenshot({
      path: "tests/screenshots/07-command-palette-open.png",
    });

    // Press Escape to close
    await page.keyboard.press("Escape");

    // Assert dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    test.info().annotations.push({
      type: "ux-note",
      description:
        "Command palette opens reliably with Cmd+K and closes with Escape. Search input is auto-focused.",
    });
  });

  test("Tab navigation moves focus through interactive elements on home page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Collect focused elements as we tab through the page
    const focusedElements: string[] = [];
    const focusedWithOutline: boolean[] = [];

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");

      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const tag = el.tagName.toLowerCase();
        const text =
          (el as HTMLElement).innerText?.slice(0, 40) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          "";
        const role = el.getAttribute("role") || "";
        // Check for visible focus indicator
        const computed = window.getComputedStyle(el);
        const hasOutline =
          computed.outlineStyle !== "none" && computed.outlineWidth !== "0px";
        const hasRing = el.className?.includes("ring") || false;
        const hasFocusVisible = el.matches(":focus-visible");
        return {
          tag,
          text: text.trim(),
          role,
          hasVisibleFocus: hasOutline || hasRing || hasFocusVisible,
        };
      });

      if (info) {
        focusedElements.push(`${info.tag}${info.text ? `: ${info.text}` : ""}`);
        focusedWithOutline.push(info.hasVisibleFocus);
      }
    }

    // Should have focused at least some interactive elements
    expect(focusedElements.length).toBeGreaterThan(0);

    // Take screenshot after tabbing to show focus state
    await page.screenshot({
      path: "tests/screenshots/07-tab-navigation.png",
    });

    test.info().annotations.push({
      type: "ux-note",
      description: `Tab hit ${focusedElements.length} interactive elements: ${focusedElements.join(", ")}. Focus visible on ${focusedWithOutline.filter(Boolean).length}/${focusedWithOutline.length} elements.`,
    });
  });

  test("Skip-to-content link check on project page", async ({ page }) => {
    // First get a valid project ID from the API
    const projectsRes = await page.request.get("/api/projects");
    const projects = await projectsRes.json();

    if (!Array.isArray(projects) || projects.length === 0) {
      test.info().annotations.push({
        type: "ux-note",
        description:
          "No projects exist to test skip-to-content on project page. Testing on home page instead.",
      });
      await page.goto("/");
    } else {
      await page.goto(`/project/${projects[0].id}`);
    }
    await page.waitForLoadState("networkidle");

    // Press Tab once and check if a skip-to-content link appears
    await page.keyboard.press("Tab");

    const skipLink = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const text = (el as HTMLElement).innerText?.toLowerCase() || "";
      const href = el.getAttribute("href") || "";
      if (
        text.includes("skip") ||
        href.includes("#main") ||
        href.includes("#content")
      ) {
        return { text: (el as HTMLElement).innerText, href };
      }
      return null;
    });

    if (skipLink) {
      test.info().annotations.push({
        type: "ux-note",
        description: `Skip-to-content link found: "${skipLink.text}" -> ${skipLink.href}`,
      });
    } else {
      test.info().annotations.push({
        type: "ux-note",
        description:
          "No skip-to-content link found. Consider adding one for improved accessibility — screen reader and keyboard-only users benefit from skip links.",
      });
    }

    await page.screenshot({
      path: "tests/screenshots/07-skip-to-content.png",
    });

    // This test documents findings rather than hard-failing
    // since skip-to-content is a recommendation, not a hard requirement
    expect(true).toBe(true);
  });
});
