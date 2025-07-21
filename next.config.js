/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Monaco Editor webpack config
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        "monaco-editor": false,
      }
    }
    return config
  },
  async rewrites() {
    return [
      {
        source: '/api/dashboard/:path*',
        destination: 'http://localhost:8000/api/dashboard/:path*',
      },
      {
        source: '/api/hardware/:path*',
        destination: 'http://localhost:8000/api/hardware/:path*',
      },
    ]
  },
}

module.exports = nextConfig 