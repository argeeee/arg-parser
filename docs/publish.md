# Publishing to npm

From the repository root, make sure the working tree contains the changes you want to release. Then install dependencies and run the package checks:

```sh
npm ci
npm test
npm run typecheck
npm run test:package
npm run check:example
```

Log in to npm if needed and confirm the account:

```sh
npm login
npm whoami
```

Choose the next semantic version and update `package.json` and `package-lock.json`. `npm version` also creates a Git commit and tag:

```sh
npm version patch   # bug fixes, e.g. 1.0.0 -> 1.0.1
# or: npm version minor
# or: npm version major
```

Build the package and inspect what will be published. The `files` field in `package.json` includes `dist`, `README.md`, and `LICENSE`.

```sh
npm run build
npm pack --dry-run
```

Publish this scoped package publicly:

```sh
npm publish --access public
```

After npm confirms the release, push the version commit and tag:

```sh
git push
git push --tags
```
