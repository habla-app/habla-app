/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@habla/shared", "@habla/ui"],
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
