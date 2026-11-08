/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Workers has no /_next/image optimizer, so serve all images as-is.
    unoptimized: true,
    // Prefer modern formats where the browser negotiates them. With
    // unoptimized:true these are hints for the few places that do use
    // next/image, and harmless elsewhere.
    formats: ['image/avif', 'image/webp'],
    // SVGs are explicitly disallowed since they can carry inline scripts.
    // The platform only accepts raster images (PNG/JPEG/WebP/AVIF) from R2.
    dangerouslyAllowSVG: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      // Cloudflare Images delivery — used by the scholar-of-the-day and
      // banner slots when the Cloudflare Images product is enabled.
      {
        protocol: 'https',
        hostname: 'imagedelivery.net',
      },
    ],
  },
};

export default nextConfig;
