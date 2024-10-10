/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3002/api/:path*',
      },
    ]
  },
  images: {
    domains: ['localhost', 'example.com'], // Add any other domains you might use for images
  },
}

module.exports = nextConfig