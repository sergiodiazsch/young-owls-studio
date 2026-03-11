/**
 * Environment variable validation and typed exports.
 *
 * Import this module early in server-side entry points (e.g. DB init,
 * API routes) to fail fast when required variables are missing.
 *
 * Client-side code (typeof window !== 'undefined') skips validation
 * because server-only secrets are not available in the browser.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Check .env.local or your deployment's environment settings.`
    );
  }
  return value;
}

// ---------- Server-only validation ----------
// Only validate when running on the server (build-time & runtime).
// Next.js may import this file during client bundling, so guard accordingly.

let _ANTHROPIC_API_KEY = "";
let _NETLIFY_DATABASE_URL = "";

if (typeof window === "undefined") {
  _ANTHROPIC_API_KEY = requireEnv("ANTHROPIC_API_KEY");
  _NETLIFY_DATABASE_URL =
    process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || "";

  if (!_NETLIFY_DATABASE_URL) {
    throw new Error(
      "Missing required environment variable: NETLIFY_DATABASE_URL (or DATABASE_URL). " +
        "Check .env.local or your deployment's environment settings."
    );
  }
}

// ---------- Required ----------
export const ANTHROPIC_API_KEY = _ANTHROPIC_API_KEY;
export const NETLIFY_DATABASE_URL = _NETLIFY_DATABASE_URL;

// ---------- Optional ----------
export const NODE_EXTRA_CA_CERTS = process.env.NODE_EXTRA_CA_CERTS ?? "";
export const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
