import { WifiOff, HardDrive, Github, Puzzle, Monitor } from 'lucide-react';

import { Marquee } from '@/components/magicui/marquee';

const badges = [
  { icon: WifiOff, label: 'Offline First' },
  { icon: HardDrive, label: 'Local Storage' },
  { icon: Github, label: 'Open Source' },
  { icon: Puzzle, label: 'Plugin System' },
  { icon: Monitor, label: 'Cross-platform' },
];

export default function SocialProof() {
  return (
    <section className="py-12 overflow-hidden">
      <Marquee pauseOnHover className="[--duration:30s]">
        {badges.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary"
          >
            <Icon className="h-4 w-4 text-accent" />
            <span>{label}</span>
          </div>
        ))}
      </Marquee>
    </section>
  );
}
