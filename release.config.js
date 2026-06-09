export default {
  branches: ['main', { name: 'beta', prerelease: true }],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { breaking: true, release: 'major' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance' },
            { type: 'refactor', section: 'Refactoring', hidden: true },
            { type: 'docs', section: 'Documentation', hidden: true },
            { type: 'chore', hidden: true },
            { type: 'test', hidden: true },
            { type: 'ci', hidden: true },
          ],
        },
      },
    ],
    '@semantic-release/changelog',
    // Note: the previous @semantic-release/exec step ran a custom
    // scripts/bump-version.js to sync per-package versions. That script was
    // deleted in the knip cleanup (#279) and the desktop release only needs
    // the root + apps/desktop package.json versions bumped — which the
    // @semantic-release/git plugin below does via the `assets` list. So we
    // drop the exec step entirely.
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'apps/desktop/package.json'],
        message: 'chore(release): v${nextRelease.version} [skip ci]',
      },
    ],
    [
      '@semantic-release/github',
      {
        draftRelease: true,
      },
    ],
  ],
};
