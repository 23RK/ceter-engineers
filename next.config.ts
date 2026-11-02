import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Project documents and update attachments (up to 4MB per upload,
      // src/lib/form-values.ts) - Vercel's own cap on a request is 4.5MB.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
