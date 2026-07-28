/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // engine thao tac DOM truc tiep -> khong chay effect 2 lan
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // pptxgenjs / xlsx la thu vien browser, khong can polyfill node core module
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    return config;
  },
};

export default nextConfig;
