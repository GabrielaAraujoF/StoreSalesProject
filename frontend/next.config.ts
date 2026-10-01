import type { NextConfig } from "next";

import { getBackendUrl } from "./lib/backend-url";

const backendUrl = getBackendUrl();

const nextConfig: NextConfig = {
  // Flask distinguishes routes with and without a trailing slash. Preserve the
  // requested API path so its redirects do not bypass this proxy. One wildcard
  // rule avoids an ambiguous production match that appended a slash to paths
  // such as /api/sellers/active.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
