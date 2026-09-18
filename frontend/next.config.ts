import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Evidence fixtures are fetched by GenLayer validators: serve them as
        // plain, cache-light HTML so every validator reads the same bytes.
        source: "/evidence/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
