import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support for Turbopack (Next.js 15/16 default)
  experimental: {
    turbo: {
      resolveAlias: {
        fs: "browser",
        path: "browser",
      },
    },
  },
  // Support for standard Webpack
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
