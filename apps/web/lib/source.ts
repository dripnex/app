import { docs } from '@/.source';
import { createMDXSource } from 'fumadocs-mdx/runtime/next';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs.docs, docs.meta),
});
