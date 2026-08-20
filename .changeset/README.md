# Changesets

Versioning for workspace packages (`@dripnex/*` libs). App releases stay on semantic-release (`release.config.js`).

```sh
pnpm changeset
```

That writes a markdown file in this folder. It is not a publish — packages stay `private` until we extract or publish them.
