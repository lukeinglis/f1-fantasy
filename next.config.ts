import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          // Prevent iframe embedding (clickjacking protection)
          { key: "X-Frame-Options", value: "DENY" },
          // Modern equivalent of X-Frame-Options
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
