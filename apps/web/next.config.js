/** @type {import('next').NextConfig} */
const apiServerUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [{ source: '/api-proxy/:path*', destination: `${apiServerUrl}/:path*` }];
  },
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/favicon.svg', permanent: false }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
    // In dev, image optimizer can 500 on some external URLs; skip optimization to avoid
    unoptimized: process.env.NODE_ENV === 'development',
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ];
    if (isProd) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }
    return [
      { source: '/(.*)', headers: securityHeaders },
      // Telegram Web App: allow opening in Telegram client (no X-Frame-Options for this path)
      {
        source: '/telegram-app/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://web.telegram.org https://telegram.org;" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
