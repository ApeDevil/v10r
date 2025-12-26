# Biome CI/CD Integration

Integrating Biome into continuous integration and deployment pipelines.

## Contents

- [Commands for CI](#commands-for-ci) - biome ci vs biome check
- [GitHub Actions](#github-actions) - Official action setup
- [Pre-commit Hooks](#pre-commit-hooks) - Husky integration
- [Vercel](#vercel) - Build integration
- [Other CI Platforms](#other-ci-platforms) - GitLab, CircleCI, etc.
- [Caching](#caching) - Speed up CI runs
- [Monorepo Setup](#monorepo-setup) - Multi-package projects

## Commands for CI

### `biome ci` vs `biome check`

| Command | Warnings | Exits with error | Use case |
|---------|----------|------------------|----------|
| `biome check` | Reported | Only on errors | Development |
| `biome ci` | Become errors | On any issue | CI pipelines |

```bash
# Development - warnings don't fail
bunx biome check .

# CI - warnings fail the build
bunx biome ci .
```

### Useful Flags

```bash
# Check specific files/patterns
biome ci src/

# Check staged files only
biome check --staged

# Output as JSON (for parsing)
biome ci --reporter=json .

# Suppress diagnostics count
biome ci --reporter=summary .
```

## GitHub Actions

### Official Setup Action

```yaml
# .github/workflows/lint.yml
name: Lint

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: biomejs/setup-biome@v2
        with:
          version: latest  # or specific: "1.5.0"

      - run: biome ci .
```

### With Bun

```yaml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint
        run: bunx biome ci .
```

### Full SvelteKit Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx biome ci .

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx svelte-check --tsconfig ./tsconfig.json

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
```

### PR Comments (reviewdog)

```yaml
name: Lint PR

on: pull_request

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: biomejs/setup-biome@v2

      - name: Run Biome
        run: biome ci --reporter=json . > biome-report.json || true

      - uses: reviewdog/action-setup@v1

      - name: Post review comments
        env:
          REVIEWDOG_GITHUB_API_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cat biome-report.json | reviewdog -f=biome -reporter=github-pr-review
```

## Pre-commit Hooks

### Husky Setup (Recommended)

```bash
# Install
bun add -D husky
bunx husky init
```

```bash
# .husky/pre-commit
#!/bin/sh
bunx biome check --staged --write .
```

### With lint-staged

```bash
bun add -D husky lint-staged
bunx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx,json,svelte}": [
      "biome check --write --no-errors-on-unmatched"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/bin/sh
bunx lint-staged
```

### Pre-push Hook

```bash
# .husky/pre-push
#!/bin/sh
bunx biome ci .
bunx svelte-check --tsconfig ./tsconfig.json
```

## Vercel

### Build Command

```json
{
  "scripts": {
    "build": "biome ci . && vite build"
  }
}
```

Or in `vercel.json`:

```json
{
  "buildCommand": "bunx biome ci . && bun run build"
}
```

### Ignore Build Step

Skip linting on non-code changes:

```bash
#!/bin/bash
# vercel-ignore-build-step.sh

# Check if only docs/assets changed
if git diff --quiet HEAD^ HEAD -- ':!*.md' ':!*.png' ':!*.jpg'; then
  echo "Only docs changed, skipping build"
  exit 0
fi

exit 1
```

## Other CI Platforms

### GitLab CI

```yaml
# .gitlab-ci.yml
lint:
  image: oven/bun:latest
  script:
    - bun install --frozen-lockfile
    - bunx biome ci .
```

### CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  lint:
    docker:
      - image: oven/bun:latest
    steps:
      - checkout
      - run: bun install --frozen-lockfile
      - run: bunx biome ci .

workflows:
  main:
    jobs:
      - lint
```

### Azure Pipelines

```yaml
# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: UseNode@1
    inputs:
      version: '20.x'

  - script: |
      npm install -g bun
      bun install --frozen-lockfile
      bunx biome ci .
    displayName: 'Lint'
```

## Caching

### GitHub Actions Cache

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - name: Cache Bun dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - run: bun install --frozen-lockfile
      - run: bunx biome ci .
```

### Biome Binary Cache

The `biomejs/setup-biome` action automatically caches the Biome binary.

## Monorepo Setup

### Root-level Config

```
project/
├── biome.json           # Root config
├── packages/
│   ├── web/
│   │   └── biome.json   # Extends root
│   └── api/
│       └── biome.json   # Extends root
```

**Root biome.json:**
```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": {
    "indentStyle": "tab"
  },
  "linter": {
    "rules": {
      "recommended": true
    }
  }
}
```

**Package biome.json:**
```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["../../biome.json"],
  "overrides": [
    {
      "include": ["*.svelte"],
      "linter": {
        "rules": {
          "style": { "useConst": "off" }
        }
      }
    }
  ]
}
```

### CI for Monorepo

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [web, api, shared]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx biome ci packages/${{ matrix.package }}
```

### Parallel Linting

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - name: Lint all packages
        run: |
          bunx biome ci packages/web &
          bunx biome ci packages/api &
          wait
```

## Best Practices

### 1. Fail Fast

Run linting early in the pipeline:

```yaml
jobs:
  lint:
    # Runs immediately
  test:
    needs: [lint]  # Waits for lint
  build:
    needs: [lint, test]
```

### 2. Use `--frozen-lockfile`

Always use `--frozen-lockfile` in CI:

```bash
bun install --frozen-lockfile
```

### 3. Pin Biome Version

Avoid surprises from version updates:

```json
{
  "devDependencies": {
    "@biomejs/biome": "2.0.0"
  }
}
```

### 4. Separate Lint and Format Checks

For better error messages:

```yaml
- name: Check formatting
  run: biome format --check .

- name: Check linting
  run: biome lint .
```

### 5. Use CI Reporter

```bash
biome ci --reporter=github .
```

Outputs GitHub-formatted annotations for inline PR comments.
