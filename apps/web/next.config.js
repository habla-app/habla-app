/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@habla/shared", "@habla/ui"],
  output: "standalone",
};

module.exports = nextConfig;
