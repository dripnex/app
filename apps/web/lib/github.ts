export interface PlatformAsset {
  name: string;
  downloadUrl: string;
  size: number;
  platform: 'mac' | 'win' | 'linux';
  arch?: 'arm64' | 'x64';
  format: string;
}

export interface ReleaseInfo {
  version: string;
  publishedAt: string;
  assets: PlatformAsset[];
}

function detectPlatform(name: string): PlatformAsset['platform'] | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.dmg') || (lower.endsWith('.zip') && lower.includes('mac'))) return 'mac';
  if (lower.endsWith('.exe') || lower.endsWith('.msi')) return 'win';
  if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm'))
    return 'linux';
  return null;
}

function detectArch(name: string): PlatformAsset['arch'] | undefined {
  const lower = name.toLowerCase();
  if (lower.includes('arm64') || lower.includes('aarch64')) return 'arm64';
  if (lower.includes('x64') || lower.includes('x86_64') || lower.includes('amd64')) return 'x64';
  return undefined;
}

function detectFormat(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext || 'unknown';
}

export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('https://api.github.com/repos/dripnex/readide/releases', {
      headers,
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const releases = await res.json();

    const release = releases.find(
      (r: { draft: boolean; prerelease: boolean }) => !r.draft && !r.prerelease
    );

    if (!release) return null;

    const version = (release.tag_name as string).replace(/^v/, '');

    const assets: PlatformAsset[] = [];
    for (const asset of release.assets) {
      if (
        asset.name.endsWith('.blockmap') ||
        asset.name.endsWith('.yml') ||
        asset.name.endsWith('.yaml')
      ) {
        continue;
      }

      const platform = detectPlatform(asset.name);
      if (!platform) continue;

      assets.push({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
        size: asset.size,
        platform,
        arch: detectArch(asset.name),
        format: detectFormat(asset.name),
      });
    }

    return {
      version,
      publishedAt: release.published_at,
      assets,
    };
  } catch {
    return null;
  }
}

export interface ChangelogEntry {
  type: string;
  text: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  body: string;
  changes: ChangelogEntry[];
  url: string;
}

function parseReleaseBody(body: string): ChangelogEntry[] {
  const changes: ChangelogEntry[] = [];
  const lines = body.split('\n');
  let currentType = 'changed';

  for (const line of lines) {
    const typeMatch = line.match(/^###?\s+(\w+)/);
    if (typeMatch) {
      currentType = typeMatch[1].toLowerCase();
      continue;
    }

    const itemMatch = line.match(/^[-*]\s+(.+)/);
    if (itemMatch) {
      changes.push({ type: currentType, text: itemMatch[1].trim() });
    }
  }

  return changes;
}

export async function fetchAllReleases(): Promise<ChangelogRelease[]> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('https://api.github.com/repos/dripnex/readide/releases?per_page=50', {
      headers,
      next: { revalidate: 300 },
    });

    if (!res.ok) return [];

    const releases = await res.json();

    return releases
      .filter((r: { draft: boolean }) => !r.draft)
      .map(
        (r: {
          tag_name: string;
          published_at: string;
          body: string;
          html_url: string;
          prerelease: boolean;
        }) => {
          const version = r.tag_name.replace(/^v/, '');
          const date = new Date(r.published_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const body = r.body || '';
          const changes = parseReleaseBody(body);

          return {
            version,
            date,
            body,
            changes,
            url: r.html_url,
          };
        }
      );
  } catch {
    return [];
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
