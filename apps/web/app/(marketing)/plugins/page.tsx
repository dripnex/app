import type { Metadata } from 'next';
import Link from 'next/link';
import PluginFilter from '@/components/PluginFilter';
import pluginsData from '@/data/plugins.json';

export const metadata: Metadata = {
  title: 'Plugins — Dripnex',
  description: 'Core plugins ship in the app. Community plugins are their own git repos.',
};

export default function PluginsPage() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="relative max-w-5xl mx-auto z-10">
        <header className="text-center mb-10">
          <span className="section-label">Plugins</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-4">
            Extend <span className="text-accent">Dripnex</span>
          </h1>
          <p className="text-lg text-text-secondary max-w-[50ch] mx-auto leading-relaxed">
            Core plugins ship in the app. Anything else is its own repository — tagged, packed,
            installed by name.
          </p>
        </header>

        <PluginFilter plugins={pluginsData} />

        <aside className="mt-16 mx-auto max-w-2xl border-t border-white/[0.06] pt-10">
          <h2 className="text-[15px] font-medium text-text-primary">Your plugin is a repo</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
            One git repository per plugin. Version is the git tag. The artifact is the tarball from{' '}
            <code className="font-mono text-accent">dripnex-plugin pack</code> attached to that
            GitHub release.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-md bg-white/[0.04] px-4 py-3 font-mono text-[13px] text-text-secondary">
            {`dripnex-plugin install dripnex/plugin-stamp
# or Settings → Plugins → Connect`}
          </pre>
          <p className="mt-4 text-[13px] text-text-muted">
            First community plugin:{' '}
            <a
              href="https://github.com/dripnex/plugin-stamp"
              className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
            >
              dripnex/plugin-stamp
            </a>
            .{' '}
            <Link
              href="/docs/plugins/publishing"
              className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
            >
              How to publish
            </Link>
            .
          </p>
        </aside>
      </div>
    </section>
  );
}
