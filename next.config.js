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
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
  },
  // ... other configurations
}

module.exports = nextConfig