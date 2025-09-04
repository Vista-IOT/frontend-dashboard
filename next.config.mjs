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
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/dashboard/:path*",
        destination: "http://127.0.0.1:8000/api/dashboard/:path*",
      },
      {
        source: "/api/hardware/:path*",
        destination: "http://127.0.0.1:8000/api/hardware/:path*",
      },
      {
        source: "/api/io/polled-values",
        destination: "http://127.0.0.1:8000/deploy/api/io/polled-values",
      },
      {
        source: "/deploy/api/:path*",
        destination: "http://127.0.0.1:8000/deploy/api/:path*",
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
};

export default nextConfig;
