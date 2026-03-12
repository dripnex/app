import type { Metadata } from 'next';
import { Download, Check, Cpu, ExternalLink } from 'lucide-react';
import { getProductConfig } from '@readied/product-config';
import { fetchLatestRelease, formatBytes } from '@/lib/github';
import type { PlatformAsset } from '@/lib/github';
import NewsletterForm from '@/components/NewsletterForm';

const config = getProductConfig();

export const metadata: Metadata = {
  title: 'Download — Readied',
  description: `Download Readied for macOS, Windows, or Linux. Try free for ${config.trialDays} days.`,
};

function primaryLabel(asset: PlatformAsset): string {
  if (asset.platform === 'mac') {
    return asset.arch === 'arm64' ? 'Apple Silicon' : 'Intel';
  }
  if (asset.platform === 'win') {
    return asset.format === 'exe' ? 'Windows x64' : 'Portable';
  }
  if (asset.platform === 'linux') {
    return asset.format === 'appimage' ? 'AppImage' : asset.format.toUpperCase();
  }
  return asset.name;
}

export default async function DownloadPage() {
  const release = await fetchLatestRelease();
  const version = release?.version;
  const isReleased = !!release;

  function getAssets(platform: PlatformAsset['platform']) {
    return release?.assets.filter(a => a.platform === platform) ?? [];
  }

  const macAssets = getAssets('mac');
  const winAssets = getAssets('win');
  const linuxAssets = getAssets('linux');

  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="relative max-w-5xl mx-auto z-10">
        <header className="text-center mb-16">
          <span className="section-label">Download</span>
          <h1 className="section-heading sm:text-4xl lg:text-5xl mb-3">
            Get <span className="text-accent">Readied</span>
          </h1>
          {isReleased ? (
            <>
              <p className="text-lg text-[#a1a1aa] mb-5">
                Try free for {config.trialDays} days. No account required.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="inline-flex items-center px-5 py-2 font-mono text-sm font-semibold rounded-full bg-accent/10 border border-accent/20 text-accent">
                  v{version}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                  <Check size={12} />
                  Free forever
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg text-[#a1a1aa] mb-5">
                We&apos;re building something good. Leave your email to get notified.
              </p>
              <span className="inline-flex items-center px-5 py-2 font-mono text-sm font-semibold rounded-full bg-white/[0.05] border border-white/[0.08] text-[#a1a1aa]">
                Coming Soon
              </span>
              <div className="mt-10">
                <NewsletterForm />
              </div>
            </>
          )}
        </header>

        <div
          className={`grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 ${!isReleased ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* macOS */}
          <article className="rounded-xl bg-surface p-6 sm:p-8 flex flex-col gap-6">
            <header className="flex items-center gap-5">
              <div className="w-14 h-14 flex items-center justify-center shrink-0 bg-accent/10 rounded-lg text-accent">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#f4f4f5] mb-1">macOS</h2>
                <span className="text-sm text-[#71717a]">macOS 11 Big Sur or later</span>
              </div>
            </header>
            <div className="flex flex-wrap gap-3">
              {macAssets.length > 0 ? (
                macAssets.map((asset, i) => (
                  <a
                    key={asset.name}
                    href={asset.downloadUrl}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${i === 0 ? 'bg-accent text-white hover:bg-accent-hover' : 'border border-white/[0.08] text-[#a1a1aa] hover:bg-white/5'}`}
                  >
                    {i === 0 && <Download size={16} />}
                    {primaryLabel(asset)}
                    <span className="text-xs opacity-70">({formatBytes(asset.size)})</span>
                  </a>
                ))
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/50 text-white/50 cursor-not-allowed">
                    <Download size={16} />
                    Apple Silicon
                  </span>
                  <span className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium border border-white/[0.08] text-[#71717a] cursor-not-allowed">
                    Intel
                  </span>
                </>
              )}
            </div>
            <div className="rounded-lg bg-inset border border-white/[0.06] p-4 font-mono text-xs text-[#a1a1aa] overflow-x-auto">
              <p className="text-[#71717a] mb-2"># Install from DMG</p>
              <p>hdiutil attach Readied-*.dmg</p>
              <p>cp -R /Volumes/Readied/Readied.app /Applications/</p>
              <p>hdiutil detach /Volumes/Readied</p>
            </div>
          </article>

          {/* Windows */}
          <article className="rounded-xl bg-surface p-6 sm:p-8 flex flex-col gap-6">
            <header className="flex items-center gap-5">
              <div className="w-14 h-14 flex items-center justify-center shrink-0 bg-accent/10 rounded-lg text-accent">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#f4f4f5] mb-1">Windows</h2>
                <span className="text-sm text-[#71717a]">Windows 10 (64-bit) or later</span>
              </div>
            </header>
            <div className="flex flex-wrap gap-3">
              {winAssets.length > 0 ? (
                winAssets.map((asset, i) => (
                  <a
                    key={asset.name}
                    href={asset.downloadUrl}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${i === 0 ? 'bg-accent text-white hover:bg-accent-hover' : 'border border-white/[0.08] text-[#a1a1aa] hover:bg-white/5'}`}
                  >
                    {i === 0 && <Download size={16} />}
                    {primaryLabel(asset)}
                    <span className="text-xs opacity-70">({formatBytes(asset.size)})</span>
                  </a>
                ))
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/50 text-white/50 cursor-not-allowed">
                    <Download size={16} />
                    Windows x64
                  </span>
                  <span className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium border border-white/[0.08] text-[#71717a] cursor-not-allowed">
                    Portable
                  </span>
                </>
              )}
            </div>
            <div className="rounded-lg bg-inset border border-white/[0.06] p-4 font-mono text-xs text-[#a1a1aa] overflow-x-auto">
              <p className="text-[#71717a] mb-2"># Run the installer</p>
              <p>Readied-Setup-*.exe /S</p>
            </div>
          </article>

          {/* Linux */}
          <article className="rounded-xl bg-surface p-6 sm:p-8 flex flex-col gap-6">
            <header className="flex items-center gap-5">
              <div className="w-14 h-14 flex items-center justify-center shrink-0 bg-accent/10 rounded-lg text-accent">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M12.503 18.894c-.048.084-.182.123-.314.084l-1.257-.373c-.132-.039-.186-.137-.137-.221l4.204-7.333c.048-.084.182-.123.314-.084l1.257.373c.132.039.186.137.137.221l-4.204 7.333zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.614 15.59L12 22l-3.614-4.41L3.5 12l4.886-5.59L12 2l3.614 4.41L20.5 12l-4.886 5.59z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#f4f4f5] mb-1">Linux</h2>
                <span className="text-sm text-[#71717a]">Ubuntu 20.04+ / Fedora 36+</span>
              </div>
            </header>
            <div className="flex flex-wrap gap-3">
              {linuxAssets.length > 0 ? (
                linuxAssets.map((asset, i) => (
                  <a
                    key={asset.name}
                    href={asset.downloadUrl}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${i === 0 ? 'bg-accent text-white hover:bg-accent-hover' : 'border border-white/[0.08] text-[#a1a1aa] hover:bg-white/5'}`}
                  >
                    {i === 0 && <Download size={16} />}
                    {primaryLabel(asset)}
                    <span className="text-xs opacity-70">({formatBytes(asset.size)})</span>
                  </a>
                ))
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/50 text-white/50 cursor-not-allowed">
                    <Download size={16} />
                    AppImage
                  </span>
                  <span className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium border border-white/[0.08] text-[#71717a] cursor-not-allowed">
                    .deb
                  </span>
                </>
              )}
            </div>
            <div className="rounded-lg bg-inset border border-white/[0.06] p-4 font-mono text-xs text-[#a1a1aa] overflow-x-auto">
              <p className="text-[#71717a] mb-2"># Make executable and run</p>
              <p>chmod +x Readied.AppImage && ./Readied.AppImage</p>
            </div>
          </article>
        </div>

        {/* System Requirements */}
        <section className="glass-card p-6 sm:p-8 mb-10">
          <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6 flex items-center gap-3">
            <Cpu size={20} className="text-accent" />
            System requirements
          </h3>
          <dl className="flex flex-col">
            <div className="flex justify-between items-center py-4 border-b border-white/[0.06]">
              <dt className="text-sm text-[#71717a] font-medium">RAM</dt>
              <dd className="text-sm text-[#a1a1aa] font-medium">4 GB minimum</dd>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/[0.06]">
              <dt className="text-sm text-[#71717a] font-medium">Disk</dt>
              <dd className="text-sm text-[#a1a1aa] font-medium">200 MB</dd>
            </div>
            <div className="flex justify-between items-center py-4">
              <dt className="text-sm text-[#71717a] font-medium">Display</dt>
              <dd className="text-sm text-[#a1a1aa] font-medium">1280x720 minimum</dd>
            </div>
          </dl>
        </section>

        {/* Verification */}
        <section className="py-6">
          <h3 className="text-lg font-semibold text-[#f4f4f5] mb-3">Verification</h3>
          <p className="text-base text-[#a1a1aa] leading-relaxed">
            Each release includes SHA256 checksums. Source available on{' '}
            <a
              href="https://github.com/tomymaritano/readide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2 inline-flex items-center gap-1 transition-colors hover:text-accent-hover hover:no-underline"
            >
              GitHub
              <ExternalLink size={14} />
            </a>
            .
          </p>
        </section>
      </div>
    </section>
  );
}
