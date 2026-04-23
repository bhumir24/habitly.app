"use client";

/**
 * Catches errors in the root layout. Must define <html> and <body> itself.
 * https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: 24 }}>
        <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
        <pre style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => reset()}
          style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
