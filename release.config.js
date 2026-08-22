export default {
  repositoryUrl: 'https://github.com/dripnex/app.git',
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
    // Do not commit version bumps to main. Branch rules require a PR;
    // github-actions cannot push HEAD:main. The tag points at the merge
    // SHA; Build & Publish runs bump-version.mjs from the tag name before
    // electron-builder so the binary version is still correct.
    [
      '@semantic-release/github',
      {
        draftRelease: true,
      },
    ],
  ],
};
