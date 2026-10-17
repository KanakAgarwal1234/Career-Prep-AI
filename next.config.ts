import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  // This app lives in a sub-folder of a repo that has its own lockfile.
  turbopack: { root: __dirname },
  async headers() {
    return [
      {
        // The interview chamber needs the microphone; everything else is locked down.
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
