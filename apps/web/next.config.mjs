/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint is run as its own CI step; keep it from blocking the production build.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    '@psr/config',
    '@psr/grading-rules',
    '@psr/providers',
    '@psr/testing',
    '@psr/types',
    '@psr/ui',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    // Allow the configured Supabase origin (incl. local http://127.0.0.1:port and
    // its websocket) so the browser auth/realtime clients can reach it. Hosted
    // Supabase (https) is already covered by the `https:`/`wss:` sources.
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');
    const csp = [
      "default-src 'self'",
      // jsdelivr: Tesseract.js workers importScripts() their engine from the
      // CDN, and blob: workers inherit this page CSP — without the CDN here
      // on-device OCR dies before it starts.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // blob: worker + wasm for on-device OCR (Tesseract.js); https for its assets.
      "worker-src 'self' blob:",
      `connect-src 'self' https: wss: blob: ${supabaseOrigin} ${supabaseWs}`.trim(),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
