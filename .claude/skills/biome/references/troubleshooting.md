# Biome Troubleshooting Guide

Common issues and solutions when using Biome.

## Contents

- [Installation Issues](#installation-issues) - Binary, platform, Bun
- [Configuration Issues](#configuration-issues) - Schema, extends, overrides
- [Svelte-Specific Issues](#svelte-specific-issues) - Runes, templates, formatting
- [VS Code Issues](#vs-code-issues) - Extension, formatting, conflicts
- [Performance Issues](#performance-issues) - Memory, speed, large projects
- [CI/CD Issues](#cicd-issues) - GitHub Actions, pre-commit
- [Rule-Specific Issues](#rule-specific-issues) - False positives, conflicts
- [Migration Issues](#migration-issues) - ESLint, Prettier compatibility

## Installation Issues

### Binary Not Found

**Symptom:** `biome: command not found`

**Solutions:**
```bash
# Use bunx instead of npx
bunx biome check .

# Check node_modules
ls node_modules/.bin/biome
```

### Platform Not Supported

**Symptom:** `Unsupported platform` error

**Solution:** Biome supports:
- Linux (x64, arm64)
- macOS (x64, arm64)
- Windows (x64)

For other platforms, use the WASM version (`@biomejs/wasm-bundler`).

### Bun Postinstall Warning

**Symptom:** `Blocked postinstall script` warning

**Solution:** Add to `package.json`:
```json
{
  "trustedDependencies": ["@biomejs/biome"]
}
```

## Configuration Issues

### Schema Not Found

**Symptom:** VS Code shows schema warnings

**Solution:** Use correct schema URL:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json"
}
```

### Extends Not Working

**Symptom:** Extended config not applied

**Solutions:**
```json
// Use relative path
{
  "extends": ["./biome.base.json"]
}

// Not absolute or package paths
// WRONG: "extends": ["@company/biome-config"]
```

### Overrides Not Applying

**Symptom:** File-specific rules not working

**Check:**
1. Pattern matches file: `"include": ["*.svelte"]`
2. Override is after general rules
3. No conflicting extends

```json
{
  "linter": {
    "rules": {
      "style": { "useConst": "error" }
    }
  },
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

### Files Not Being Processed

**Symptom:** Some files ignored unexpectedly

**Check:**
```json
{
  "files": {
    "ignore": []  // Check what's excluded
  },
  "vcs": {
    "useIgnoreFile": true  // .gitignore is applied
  }
}
```

To include a gitignored file:
```json
{
  "files": {
    "include": ["dist/types.d.ts"]
  }
}
```

## Svelte-Specific Issues

### useConst Error on $state

**Symptom:** `Prefer const over let` on reactive state

**Cause:** Svelte 5 runes require `let`

**Solution:**
```json
{
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

### noUnusedVariables False Positive

**Symptom:** Variables used in template marked unused

**Cause:** Biome doesn't fully parse Svelte templates

**Solution:**
```json
{
  "overrides": [
    {
      "include": ["*.svelte"],
      "linter": {
        "rules": {
          "correctness": { "noUnusedVariables": "off" }
        }
      }
    }
  ]
}
```

### Runes Not Recognized

**Symptom:** `$state is not defined`

**Solution:** Add to globals:
```json
{
  "javascript": {
    "globals": ["$state", "$derived", "$effect", "$props", "$bindable", "$inspect"]
  }
}
```

### Template Formatting Broken

**Symptom:** `{#if}` blocks formatted incorrectly

**Cause:** Biome's Svelte support is experimental

**Solution:** Use Svelte extension for formatting `.svelte` files:
```json
// .vscode/settings.json
{
  "[svelte]": {
    "editor.defaultFormatter": "svelte.svelte-vscode"
  }
}
```

## VS Code Issues

### Biome Not Formatting

**Symptom:** Format on save not working

**Check:**
```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

### Conflict with Other Formatters

**Symptom:** Formatting flickers or inconsistent

**Solution:** Disable other formatters:
```json
{
  "prettier.enable": false,
  "eslint.enable": false,
  "editor.defaultFormatter": "biomejs.biome"
}
```

### Extension Not Starting

**Symptom:** Biome status shows error

**Solutions:**
1. Check Output panel → Biome for errors
2. Restart VS Code
3. Check `biome.json` is valid JSON
4. Ensure `@biomejs/biome` is installed

### Memory Usage High

**Symptom:** VS Code using excessive RAM (>2GB for Biome)

**Known issue:** Biome v2.1.0 had memory leak

**Solutions:**
1. Update to latest Biome version
2. Restart VS Code periodically
3. Report issue with reproduction

## Performance Issues

### Slow on Large Projects

**Symptom:** `biome check` takes >10 seconds

**Solutions:**
```json
{
  "files": {
    "ignore": [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".svelte-kit/**",
      "coverage/**",
      "*.min.js"
    ]
  }
}
```

### High Memory Usage

**Symptom:** biome process using >1GB RAM

**Solutions:**
1. Update Biome version
2. Exclude large generated files
3. Run on specific directories: `biome check src/`

### CI Taking Too Long

**Symptom:** Lint job slower than expected

**Solutions:**
```yaml
# Cache dependencies
- uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('bun.lockb') }}

# Use setup-biome for binary caching
- uses: biomejs/setup-biome@v2
```

## CI/CD Issues

### GitHub Actions Failing

**Symptom:** `biome ci` exits with error

**Check:**
1. All warnings become errors in `biome ci`
2. Review output for specific rules failing
3. Consider using `--reporter=github` for annotations

```yaml
- run: biome ci --reporter=github .
```

### Pre-commit Hook Not Running

**Symptom:** Commits go through without lint

**Check:**
```bash
# Verify hook exists
cat .husky/pre-commit

# Check hook is executable
chmod +x .husky/pre-commit

# Test manually
.husky/pre-commit
```

### Staged Files Not Checked

**Symptom:** `--staged` not working

**Requirements:**
- Biome v1.7.0+
- Must be in git repository
- Files must be staged (`git add`)

```bash
# Debug
git status
bunx biome check --staged --verbose .
```

## Rule-Specific Issues

### noExplicitAny Too Strict

**Symptom:** Can't use `any` even when needed

**Solution:** Use `unknown` or disable per-file:
```typescript
// biome-ignore lint/suspicious/noExplicitAny: required for legacy API
const data: any = legacyFunction();
```

Or configure:
```json
{
  "linter": {
    "rules": {
      "suspicious": { "noExplicitAny": "warn" }
    }
  }
}
```

### noConsoleLog in Development

**Symptom:** Want console.log during development

**Solutions:**
1. Set to warn (not error):
```json
{
  "linter": {
    "rules": {
      "suspicious": { "noConsoleLog": "warn" }
    }
  }
}
```

2. Use `biome check` (not `biome ci`) locally

3. Disable in specific files:
```typescript
// biome-ignore lint/suspicious/noConsoleLog: debugging
console.log(data);
```

### Inline Ignore Comments

**Syntax:**
```typescript
// Ignore next line
// biome-ignore lint/suspicious/noExplicitAny: reason
const x: any = foo;

// Ignore specific rule in block
/* biome-ignore lint/complexity/noForEach: performance not critical here */
items.forEach(item => process(item));
```

## Migration Issues

### Formatting Differences from Prettier

**Common differences:**
1. Object property quotes (Biome quotes less)
2. Ternary operator parentheses
3. Some edge cases with long strings

**Solution:** Accept differences or adjust settings:
```json
{
  "javascript": {
    "formatter": {
      "quoteProperties": "preserve"
    }
  }
}
```

### ESLint Rules Not Found

**Symptom:** `Unknown rule` warnings during migration

**Cause:** Not all ESLint rules have Biome equivalents

**Solutions:**
1. Check [Biome rules list](https://biomejs.dev/linter/rules/)
2. Find alternative rule
3. Accept that some rules won't migrate
4. Keep ESLint for specific plugins

### Import Sorting Different

**Symptom:** Imports sorted differently than eslint-plugin-import

**Biome order:**
1. Side-effect imports
2. External packages
3. Internal aliases (`$lib/`)
4. Relative imports

**Solution:** Accept Biome's ordering (it's consistent)

## Quick Fixes

### Reset Biome State

```bash
# Remove node_modules and reinstall
rm -rf node_modules bun.lockb
bun install

# Regenerate config
rm biome.json
bunx biome init
```

### Verify Installation

```bash
# Check version
bunx biome --version

# Check config is valid
bunx biome check --verbose biome.json

# Dry run on single file
bunx biome check --verbose src/app.ts
```

### Debug Output

```bash
# Verbose output
bunx biome check --verbose .

# JSON output for parsing
bunx biome check --reporter=json . > biome-output.json
```
