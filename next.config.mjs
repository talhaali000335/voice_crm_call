/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep mongoose out of the browser bundle: it only runs on the server (Node.js).
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
