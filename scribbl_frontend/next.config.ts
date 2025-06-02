import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Optional: More granular control - only remove specific console methods
  // compiler: {
  //   removeConsole: process.env.NODE_ENV === "production" ? {
  //     exclude: ['error', 'warn'] // Keep console.error and console.warn
  //   } : false,
  // },
};

export default nextConfig;
