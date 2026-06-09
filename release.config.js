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
    // The @semantic-release/git plugin below only COMMITS files; it does
    // not mutate them. Without this exec step, package.json and
    // apps/desktop/package.json stay at the previous version even after
    // tag/release (the v0.15.0 bug). bump-version.mjs is a pure-ESM,
    // zero-dependency script that only touches the `version` field of
    // exactly the two files in scope.
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/bump-version.mjs ${nextRelease.version}',
      },
    ],
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
