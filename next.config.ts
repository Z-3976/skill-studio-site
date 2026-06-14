import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  serverExternalPackages: ["@resvg/resvg-js", "@resvg/resvg-js-win32-x64-msvc"],
};

export default nextConfig;
