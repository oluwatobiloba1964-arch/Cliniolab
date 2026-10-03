/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Workers has no /_next/image optimizer, so serve all images as-is.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
