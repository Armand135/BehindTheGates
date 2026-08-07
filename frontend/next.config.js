/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  agentRules: false,
  // Produces a minimal self-contained server bundle (.next/standalone) for
  // the production Docker image -- no need to ship the full node_modules.
  output: "standalone",
};

module.exports = nextConfig;
