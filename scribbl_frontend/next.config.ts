import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Expose the current Vercel environment ("development", "preview", or "production") to the browser
  // so that client-side code can decide whether or not to load Google Analytics.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  /* config options here */
};

export default nextConfig;
