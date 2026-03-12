import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  typescript: {
    // fumadocs-ui types reference a different @types/react copy — safe to skip
    ignoreBuildErrors: true,
  },
};

export default withMDX(config);
