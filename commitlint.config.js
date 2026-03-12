export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'docs',
        'test',
        'chore',
        'style',
        'perf',
        'ci',
        'build',
        'revert',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
