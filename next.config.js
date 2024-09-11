/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3002',
        pathname: '/**',
      },
      // Add other patterns if needed
    ],
  },
  // ... other configurations
}

module.exports = nextConfig