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
  // Anti-framing: no other site may embed Emerge in an iframe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
