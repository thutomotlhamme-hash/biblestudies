/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // RELATIVE_ASSETS=1 builds a bundle that can be hosted from any sub-path (e.g. a static file host or artifact).
  ...(process.env.RELATIVE_ASSETS ? { assetPrefix: '.' } : {}),
};
export default nextConfig;
