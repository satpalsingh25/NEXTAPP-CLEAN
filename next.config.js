const devOrigins = process.env.REPLIT_DEV_DOMAIN
  ? [process.env.REPLIT_DEV_DOMAIN]
  : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: devOrigins,
};

export default nextConfig;
