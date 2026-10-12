import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://backend:8000/api/:path*/",
      },
      {
        source: "/media/:path*",
        destination: "http://backend:8000/media/:path*",
      },
    ];
  },
};

export default nextConfig;