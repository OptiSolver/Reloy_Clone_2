import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@loop/core"],

  images: {
    qualities: [75, 100],
  },
};

export default nextConfig;
