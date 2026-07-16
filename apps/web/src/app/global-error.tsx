'use client';

/**
 * Last-resort boundary for errors thrown in the ROOT layout itself (before the
 * app chrome mounts). Must render its own <html>/<body> and cannot depend on the
 * app layout. Prevents Vercel's raw "Application error" 500 page.
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
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: '#e8e8ee',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#9a9aa8', fontSize: '0.9rem', lineHeight: 1.5 }}>
            We hit an unexpected error loading this page. Please try again.
          </p>
          {error.digest && (
            <p style={{ color: '#6a6a78', fontSize: '0.75rem', marginTop: '0.75rem' }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.6rem 1.25rem',
              borderRadius: 10,
              border: '1px solid #2a2a38',
              background: '#16161f',
              color: '#e8e8ee',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
