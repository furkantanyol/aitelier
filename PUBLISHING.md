# Publishing Guide

This document describes how to publish new releases of aitelier to npm and update the Homebrew formula.

## Prerequisites

1. npm account with publishing access to `aitelier`
2. GitHub repository access with push permissions
3. npm token configured as `NPM_TOKEN` in GitHub Actions secrets

## Release Process

### 1. Update Version

Update the version in `/packages/cli/package.json`:

```json
{
  "version": "0.2.0"
}
```

### 2. Update Changelog

Add a new section to `CHANGELOG.md`:

```markdown
## [0.2.0] - 2026-XX-XX

### Added

- New feature description

### Changed

- Changed feature description

### Fixed

- Bug fix description
```

### 3. Update Version in CLI

Update the version in `/packages/cli/src/index.ts`:

```typescript
program.name('ft').description('...').version('0.2.0');
```

### 4. Run Full Verification

```bash
pnpm turbo build && pnpm prettier --write . && pnpm turbo lint && pnpm turbo test
```

Ensure all checks pass before proceeding.

### 5. Commit Changes

```bash
git add .
git commit -m "Bump version to v0.2.0"
git push origin main
```

### 6. Create Git Tag

```bash
git tag v0.2.0
git push origin v0.2.0
```

### 7. Automated Release

Pushing a tag triggers the GitHub Actions release workflow (`.github/workflows/release.yml`), which will:

1. Build and test the package
2. Publish to npm
3. Create a GitHub Release with changelog
4. Update the Homebrew formula with the new version and SHA256

### 8. Verify Release

After the workflow completes:

1. Check npm: https://www.npmjs.com/package/aitelier
2. Check GitHub Releases: https://github.com/furkantanyol/aitelier/releases
3. Test installation:

```bash
npm install -g aitelier@latest
ft --version
```

4. Test Homebrew (after formula update):

```bash
brew update
brew upgrade aitelier
ft --version
```

## Manual npm Publishing (if needed)

If automated publishing fails, you can publish manually:

```bash
cd packages/cli
pnpm build
pnpm test
npm publish --access public
```

## Manual Homebrew Formula Update (if needed)

If the automated formula update fails:

1. Download the tarball:

```bash
wget https://registry.npmjs.org/aitelier/-/aitelier-0.2.0.tgz
```

2. Calculate SHA256:

```bash
sha256sum aitelier-0.2.0.tgz
```

3. Update `Formula/aitelier.rb`:

```ruby
url "https://registry.npmjs.org/aitelier/-/aitelier-0.2.0.tgz"
sha256 "abc123..." # Paste the calculated SHA256
```

4. Update version in test block:

```ruby
test do
  system bin/"ft", "--version"
  assert_match "0.2.0", shell_output("#{bin}/ft --version")
end
```

5. Commit and push:

```bash
git add Formula/aitelier.rb
git commit -m "Update Homebrew formula to v0.2.0"
git push origin main
```

## Troubleshooting

### npm publish fails with authentication error

Ensure `NPM_TOKEN` is set correctly in GitHub Actions secrets:

1. Generate token at https://www.npmjs.com/settings/tokens
2. Add to GitHub: Settings → Secrets and variables → Actions → New repository secret
3. Name: `NPM_TOKEN`
4. Value: Your npm token

### Homebrew formula SHA256 mismatch

The tarball must be downloaded from npm registry to calculate the correct SHA256. Using a local build will produce a different hash.

### Version mismatch errors

Ensure version is updated in all three places:

1. `packages/cli/package.json`
2. `packages/cli/src/index.ts` (program.version)
3. `CHANGELOG.md`

## Versioning Strategy

aitelier follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes (e.g., CLI command renames, removed features)
- **MINOR** (0.2.0): New features (e.g., new commands, provider support)
- **PATCH** (0.1.1): Bug fixes and minor improvements
