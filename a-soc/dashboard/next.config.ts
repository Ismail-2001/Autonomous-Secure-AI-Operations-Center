/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react", "@tanstack/react-query"],
  },
  modularizeImports: {
    "framer-motion": {
      transform: "framer-motion/dist/es/{{member}}",
    },
  },
};

export default nextConfig;
