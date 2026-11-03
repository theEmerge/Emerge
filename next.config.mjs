/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Cloudinary already does exactly what Next's own image optimizer
    // would (resize, re-encode, pick the best format) and serves it from
    // its own global CDN - a custom loader hands width requests straight
    // to Cloudinary's URL-based transforms instead of double-optimizing
    // through Netlify. See src/lib/cloudinaryLoader.ts.
    loader: "custom",
    loaderFile: "./src/lib/cloudinaryLoader.ts",
  },
  // Security headers. The CSP lists exactly the outside hosts Emerge uses
  // (Cloudinary media + uploads, Giphy, Google Fonts, Unsplash banners).
  // 'unsafe-inline' for scripts/styles is needed by Next's inline bootstrap and
  // the theme-init script; everything else (objects, framing, base tag, form
  // targets, third-party scripts) is locked down.
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://*.giphy.com",
      "media-src 'self' blob: https://res.cloudinary.com",
      `connect-src 'self' https://api.cloudinary.com https://api.giphy.com${isDev ? " ws: wss:" : ""}`,
      "worker-src 'self' blob:",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      // API responses carry private data: never let a shared cache keep them.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};
export default nextConfig;
