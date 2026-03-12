import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@readied/product-config'],
  typescript: {
    // fumadocs-ui types reference a different @types/react copy — safe to skip
    ignoreBuildErrors: true,
  },
  webpack(webpackConfig) {
    // Workspace packages use .js extensions in TS source (ESM convention).
    // Resolve .js -> .ts so Next.js can compile them from source.
    webpackConfig.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
};

export default withMDX(config);
