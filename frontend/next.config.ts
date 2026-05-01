import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack aliases keep xeokit from pulling Node-only modules into the browser bundle.
  turbopack: {
    resolveAlias: {
      fs: "./src/lib/browser-fs.ts",
      path: "./src/lib/browser-path.ts",
      perf_hooks: "./src/lib/browser-perf-hooks.ts",
    },
  },
  // Support for standard Webpack
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        perf_hooks: false,
      };
    }
    // Handle "Critical dependency" warning from web-ifc
    config.module.exprContextCritical = false;

    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
