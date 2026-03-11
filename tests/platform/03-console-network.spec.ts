import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Test Suite 3: Console & Network Errors
 *
 * Creates its own test project, navigates through all major pages
 * and collects:
 * - Console errors
 * - Failed network requests
 * - HTTP responses with status >= 400
 *
 * Reports all findings and cleans up.
 */

interface PageReport {
  route: string;
  consoleErrors: string[];
  failedRequests: string[];
  errorResponses: { url: string; status: number }[];
}

// Noise filters: expected/harmless console messages to ignore
const NOISE_PATTERNS = [
  "favicon",
  "Hydration",
  "downloadable font",
  "third-party cookie",
  "DevTools",
  "React does not recognize",
  "Warning:",
  "next-dev.js",
  "hot-reloader",
  "webpack",
  "Fast Refresh",
  "[HMR]",
  "reportWebVitals",
  "ERR_BLOCKED_BY_CLIENT",
  "cannot contain a nested", // React DOM nesting warning
];

function isNoise(message: string): boolean {
  return NOISE_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

test.describe("Console & Network Errors Audit", () => {
  let auditProjectId: number | null = null;

  test("Audit all pages for console and network errors", async ({ page, request }) => {
    test.setTimeout(180000); // 3 minutes for full audit

    // Create a dedicated test project for this audit so it won't be
    // deleted by another test suite running in parallel
    const createResp = await request.post("/api/projects", {
      data: { title: "QA Audit Project" },
    });
    if (createResp.ok()) {
      const proj = await createResp.json();
      auditProjectId = proj.id;
      console.log(`Created audit project with ID: ${auditProjectId}`);
    }

    // Determine routes to test
    const staticRoutes = ["/", "/settings"];
    const projectRoutes: string[] = [];

    if (auditProjectId) {
      const pid = auditProjectId;
      projectRoutes.push(
        `/project/${pid}`,
        `/project/${pid}/characters`,
        `/project/${pid}/locations`,
        `/project/${pid}/breakdowns`,
        `/project/${pid}/moodboards`,
        `/project/${pid}/generate`,
        `/project/${pid}/versions`,
        `/project/${pid}/snippets`,
        `/project/${pid}/drive`,
        `/project/${pid}/scenes`,
        `/project/${pid}/script-doctor`,
        `/project/${pid}/dialogue-polish`,
        `/project/${pid}/audio-studio`,
        `/project/${pid}/budget`,
        `/project/${pid}/color-script`
      );
    }

    // Also test error routes
    const errorRoutes = ["/nonexistent", "/project/99999"];

    const allRoutes = [...staticRoutes, ...projectRoutes, ...errorRoutes];
    const allReports: PageReport[] = [];

    for (const route of allRoutes) {
      const report: PageReport = {
        route,
        consoleErrors: [],
        failedRequests: [],
        errorResponses: [],
      };

      const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (!isNoise(text)) {
            report.consoleErrors.push(text);
          }
        }
      };

      const onRequestFailed = (req: { url: () => string; method: () => string; failure: () => { errorText: string } | null }) => {
        const failure = req.failure();
        const url = req.url();
        if (
          failure?.errorText === "net::ERR_ABORTED" ||
          url.includes("favicon")
        ) {
          return;
        }
        report.failedRequests.push(
          `${req.method()} ${url} -- ${failure?.errorText || "unknown"}`
        );
      };

      const onResponse = (resp: { status: () => number; url: () => string }) => {
        const status = resp.status();
        const url = resp.url();
        if (
          status >= 400 &&
          !url.includes("favicon") &&
          !url.includes("__nextjs") &&
          !url.includes("hot-update")
        ) {
          report.errorResponses.push({ url, status });
        }
      };

      page.on("console", onConsole);
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);

      try {
        await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(500);
      } catch (err: unknown) {
        report.consoleErrors.push(
          `Navigation error: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // Remove listeners so they don't stack
      page.removeListener("console", onConsole);
      page.removeListener("requestfailed", onRequestFailed);
      page.removeListener("response", onResponse);

      allReports.push(report);
    }

    // Clean up audit project
    if (auditProjectId) {
      const delResp = await request.delete(`/api/projects/${auditProjectId}`);
      if (delResp.ok()) {
        console.log(`Deleted audit project ${auditProjectId}`);
      } else {
        console.log(`Warning: Failed to delete audit project ${auditProjectId}`);
      }
    }

    // Generate summary report
    console.log("\n====================================");
    console.log("  CONSOLE & NETWORK ERRORS REPORT  ");
    console.log("====================================\n");

    let totalConsoleErrors = 0;
    let totalFailedRequests = 0;
    let totalErrorResponses = 0;
    const pagesWithIssues: string[] = [];

    for (const report of allReports) {
      const hasIssues =
        report.consoleErrors.length > 0 ||
        report.failedRequests.length > 0 ||
        report.errorResponses.length > 0;

      if (hasIssues) {
        pagesWithIssues.push(report.route);
      }

      totalConsoleErrors += report.consoleErrors.length;
      totalFailedRequests += report.failedRequests.length;
      totalErrorResponses += report.errorResponses.length;

      const statusIcon = hasIssues ? "!!" : "OK";
      console.log(`[${statusIcon}] ${report.route}`);

      if (report.consoleErrors.length > 0) {
        for (const err of report.consoleErrors) {
          console.log(`     CONSOLE: ${err.substring(0, 200)}`);
        }
      }
      if (report.failedRequests.length > 0) {
        for (const req of report.failedRequests) {
          console.log(`     NETWORK FAIL: ${req.substring(0, 200)}`);
        }
      }
      if (report.errorResponses.length > 0) {
        for (const resp of report.errorResponses) {
          console.log(`     HTTP ${resp.status}: ${resp.url.substring(0, 200)}`);
        }
      }
    }

    console.log("\n--- Summary ---");
    console.log(`Pages audited: ${allReports.length}`);
    console.log(`Console errors: ${totalConsoleErrors}`);
    console.log(`Failed network requests: ${totalFailedRequests}`);
    console.log(`Error HTTP responses (4xx/5xx): ${totalErrorResponses}`);
    console.log(`Pages with issues: ${pagesWithIssues.length}`);
    if (pagesWithIssues.length > 0) {
      console.log(`  ${pagesWithIssues.join(", ")}`);
    }
    console.log("");

    // Take a final screenshot
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.screenshot({
      path: "tests/screenshots/03-audit-final.png",
      fullPage: true,
    });

    // Only fail on unexpected 5xx on non-error routes
    const unexpectedServerErrors = allReports
      .filter((r) => !errorRoutes.includes(r.route))
      .filter((r) =>
        r.errorResponses.some((resp) => resp.status >= 500)
      );

    if (unexpectedServerErrors.length > 0) {
      console.log("\nWARNING: Server errors (5xx) found on main routes:");
      for (const r of unexpectedServerErrors) {
        const serverErrs = r.errorResponses.filter((resp) => resp.status >= 500);
        for (const e of serverErrs) {
          console.log(`  ${r.route} -> HTTP ${e.status}: ${e.url}`);
        }
      }
    }

    expect(unexpectedServerErrors.length).toBe(0);
  });
});
