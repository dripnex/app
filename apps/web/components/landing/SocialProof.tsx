import { WifiOff, FileText, Monitor, Star } from 'lucide-react';

export default function SocialProof() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-8">
      <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm text-[#71717a]">
        <WifiOff className="h-3.5 w-3.5 text-accent" />
        <span>Works 100% offline</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm text-[#71717a]">
        <FileText className="h-3.5 w-3.5 text-accent" />
        <span>Standard Markdown</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm text-[#71717a]">
        <Monitor className="h-3.5 w-3.5 text-accent" />
        <span>macOS, Windows &amp; Linux</span>
      </div>
      <a
        href="https://github.com/tomymaritano/readide"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm text-[#71717a] transition-colors hover:text-accent hover:border-accent/20"
      >
        <Star className="h-3.5 w-3.5 text-accent" />
        <span>Star on GitHub</span>
      </a>
    </div>
  );
}
