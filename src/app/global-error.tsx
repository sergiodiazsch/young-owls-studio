"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0b", color: "#fafafa" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 420, padding: "0 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 32, lineHeight: 1.6 }}>
              A critical error occurred. Your work is safe — try reloading the page.
              {error.digest && <span style={{ display: "block", marginTop: 8, fontSize: 11, color: "#71717a" }}>Error ID: {error.digest}</span>}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => window.location.href = "/"}
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #27272a", background: "transparent", color: "#fafafa", cursor: "pointer", fontSize: 14 }}
              >
                Back to Projects
              </button>
              <button
                onClick={() => reset()}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#fafafa", color: "#0a0a0b", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
