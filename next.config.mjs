/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pollinations image/audio GET endpoints are loaded directly by the browser.
  // Media content-addressed storage is also a remote host.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gen.pollinations.ai" },
      { protocol: "https", hostname: "media.pollinations.ai" },
    ],
  },
};

export default nextConfig;
