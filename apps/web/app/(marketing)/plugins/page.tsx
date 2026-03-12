import type { Metadata } from 'next';
import PluginFilter from '@/components/PluginFilter';
import pluginsData from '@/data/plugins.json';

export const metadata: Metadata = {
  title: 'Plugins — Readied',
  description: 'Extend Readied with plugins for AI assistance, productivity, and more.',
};

export default function PluginsPage() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="relative max-w-5xl mx-auto z-10">
        <header className="text-center mb-10">
          <span className="section-label">Plugins</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-4">
            Extend <span className="text-accent">Readied</span>
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-[50ch] mx-auto leading-relaxed">
            Add powerful features to your editor with built-in and community plugins.
          </p>
        </header>

        <PluginFilter plugins={pluginsData} />
      </div>
    </section>
  );
}
