---
name: biome
description: Biome linter and formatter for Velociraptor. Use when configuring biome.json, writing lint rules, formatting code, setting up pre-commit hooks, or migrating from ESLint/Prettier. Includes SvelteKit integration, Bun setup, CI/CD patterns, and critical gotchas. Essential for any code quality configuration.
---

# Biome

All-in-one Rust-based linter, formatter, and import organizer. 10-25x faster than ESLint + Prettier.

## Contents

- [Quick Start](#quick-start) - Installation, init, basic commands
- [Configuration](#configuration) - biome.json structure, formatter, linter
- [SvelteKit Integration](#sveltekit-integration) - Svelte file support, overrides
- [Linter Rules](#linter-rules) - Recommended rules, rule groups, configuration
- [Formatter Settings](#formatter-settings) - Indent, quotes, line width
- [Import Organization](#import-organization) - Auto-sorting imports
- [Pre-commit Hooks](#pre-commit-hooks) - Husky setup, --staged flag
- [CI/CD Integration](#cicd-integration) - GitHub Actions, biome ci
- [VS Code Setup](#vs-code-setup) - Extension, settings.json
- [Migration from ESLint/Prettier](#migration-from-eslintprettier) - Automated migration
- [Bun Integration](#bun-integration) - Scripts, trusted dependencies
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Detailed guides

| Concept | Purpose |
|---------|---------|
| `biome check` | Lint + format + organize imports |
| `biome format` | Format only |
| `biome lint` | Lint only |
| `biome ci` | CI mode (error on warnings) |
| `--write` | Apply fixes |
| `--staged` | Only staged files (v1.7.0+) |

## Quick Start

```bash
# Install with exact version pinning
bun add -D -E @biomejs/biome

# Initialize configuration
bunx biome init

# Check everything
bunx biome check .

# Fix everything
bunx biome check --write .
```

**package.json scripts:**
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "lint:unsafe": "biome check --write --unsafe .",
    "format": "biome format --write ."
  }
}
```

## Configuration

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignore": [
      "dist/**",
      "build/**",
      ".svelte-kit/**",
      "node_modules/**",
      "*.min.js"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "organizeImports": {
    "enabled": true
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

### File-Specific Overrides

```json
{
  "overrides": [
    {
      "include": ["*.svelte"],
      "linter": {
        "rules": {
          "style": {
            "useConst": "off"
          }
        }
      }
    },
    {
      "include": ["*.test.ts", "*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ]
}
```

## SvelteKit Integration

**Svelte support status:** Experimental but functional (v2.3.0+)

| Feature | Status | Notes |
|---------|--------|-------|
| JS/TS in `<script>` | ✅ Works | Full support |
| CSS in `<style>` | ✅ Works | Full support |
| HTML template | ⚠️ Partial | Control flow syntax not parsed |
| Formatting | ⚠️ Partial | May not match Svelte conventions |

**Recommended overrides for Svelte:**
```json
{
  "overrides": [
    {
      "include": ["*.svelte"],
      "linter": {
        "rules": {
          "style": {
            "useConst": "off"
          },
          "correctness": {
            "noUnusedVariables": "off"
          }
        }
      }
    }
  ]
}
```

**Why these overrides:**
- `useConst`: Svelte's `$state()` requires `let`
- `noUnusedVariables`: Template usage not detected

## Linter Rules

### Rule Groups

| Group | Purpose |
|-------|---------|
| `recommended` | Sensible defaults (enable this) |
| `correctness` | Likely bugs |
| `suspicious` | Code smells |
| `style` | Consistency |
| `complexity` | Simplification |
| `performance` | Optimization |
| `security` | Vulnerabilities |
| `a11y` | Accessibility |
| `nursery` | Unstable/new rules |

### Configuring Rules

```json
{
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsoleLog": "warn"
      },
      "complexity": {
        "noForEach": "off"
      }
    }
  }
}
```

### Rule Severity

| Value | Effect |
|-------|--------|
| `"error"` | Fails check, must fix |
| `"warn"` | Reports but doesn't fail (fails in `biome ci`) |
| `"off"` | Disabled |

## Formatter Settings

### Defaults (differ from Prettier!)

| Setting | Biome Default | Prettier Default |
|---------|---------------|------------------|
| `indentStyle` | `"tab"` | `"space"` |
| `indentWidth` | `2` | `2` |
| `lineWidth` | `80` | `80` |
| `quoteStyle` | `"double"` | `"double"` |
| `trailingCommas` | `"all"` | `"all"` |
| `semicolons` | `"always"` | `"always"` |

### Override to Match Prettier

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single"
    }
  }
}
```

## Import Organization

```json
{
  "organizeImports": {
    "enabled": true
  }
}
```

Automatically sorts imports:
1. Side-effect imports (`import './styles.css'`)
2. External packages (`import { foo } from 'package'`)
3. Internal imports (`import { bar } from '$lib/utils'`)
4. Relative imports (`import { baz } from './local'`)

## Pre-commit Hooks

**Biome v1.7.0+ has built-in `--staged` flag:**

```bash
# Install
bun add -D @biomejs/biome husky
bunx husky init
```

```bash
# .husky/pre-commit
#!/bin/sh
bunx biome check --staged --write .
```

**Alternative with lint-staged:**
```json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx,json,svelte}": [
      "biome check --write --no-errors-on-unmatched"
    ]
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
        with:
          version: latest
      - run: biome ci .
```

**`biome ci` vs `biome check`:**
- `biome ci`: Warnings become errors, no fixes applied
- `biome check`: Warnings reported, can apply fixes

### Vercel Build

```json
{
  "scripts": {
    "build": "biome ci . && vite build"
  }
}
```

## VS Code Setup

Install: **Biome** extension (`biomejs.biome`)

**.vscode/settings.json:**
```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit",
    "source.fixAll.biome": "explicit"
  },
  "[svelte]": {
    "editor.defaultFormatter": "svelte.svelte-vscode"
  }
}
```

**Note:** Use Svelte extension for `.svelte` files until Biome Svelte support matures.

## Migration from ESLint/Prettier

**Automated migration:**
```bash
# Migrate ESLint config
bunx @biomejs/biome migrate eslint --write

# Migrate Prettier config
bunx @biomejs/biome migrate prettier --write
```

**What migrates:**
- ESLint rules → Biome equivalents
- Prettier settings → Biome formatter
- Ignore patterns

**What doesn't migrate:**
- YAML configs (convert to JSON first)
- Custom ESLint plugins
- GraphQL formatting

**Rule naming change:**
```
ESLint:  no-unused-vars      → Biome: noUnusedVariables
ESLint:  @typescript-eslint/ → Biome: (built-in, no prefix)
```

## Bun Integration

**Trusted dependencies (avoid postinstall warnings):**
```json
{
  "trustedDependencies": ["@biomejs/biome"]
}
```

**Full package.json setup:**
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "lint:unsafe": "biome check --write --unsafe .",
    "format": "biome format --write .",
    "prepare": "husky"
  },
  "devDependencies": {
    "@biomejs/biome": "2.0.0",
    "husky": "^9.0.0"
  },
  "trustedDependencies": ["@biomejs/biome"]
}
```

## Anti-Patterns

**Don't use dynamic class interpolation (UnoCSS gotcha):**
```typescript
// WRONG - Biome won't help, but UnoCSS won't generate these
const style = `bg-${color}-500`;

// RIGHT - use static map
const colorMap = { red: 'bg-red-500', blue: 'bg-blue-500' };
```

**Don't expect tabs by default to match your team:**
```json
// Biome defaults to tabs - override if team uses spaces
{
  "formatter": {
    "indentStyle": "space"
  }
}
```

**Don't disable recommended rules wholesale:**
```json
// WRONG - loses all benefit
{
  "linter": {
    "rules": {
      "recommended": false
    }
  }
}

// RIGHT - disable specific rules
{
  "linter": {
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "off"
      }
    }
  }
}
```

**Don't rely on Biome for Svelte template formatting:**
```svelte
<!-- Biome may not format control flow correctly -->
{#if condition}
  <div>Content</div>
{/if}

<!-- Use Svelte extension for .svelte files -->
```

**Don't forget to add --unsafe for safe-but-breaking fixes:**
```bash
# Some fixes change behavior (e.g., const → let)
biome check --write --unsafe .
```

**Don't expect UnoCSS class sorting:**
```json
// NOT YET SUPPORTED - useSortedClasses doesn't work with UnoCSS
// Use Prettier plugin or accept unsorted classes
```

## References

- **references/configuration.md** - Full biome.json schema, all options
- **references/rules.md** - Complete rule reference by group
- **references/migration.md** - ESLint/Prettier migration patterns
- **references/ci-cd.md** - CI/CD recipes for various platforms
- **references/troubleshooting.md** - Common issues and solutions
