# Biome Migration Guide

Migrating from ESLint and Prettier to Biome.

## Contents

- [Migration Overview](#migration-overview) - What to expect
- [Automated Migration](#automated-migration) - CLI commands
- [ESLint Rule Mapping](#eslint-rule-mapping) - Common rules
- [Prettier Setting Mapping](#prettier-setting-mapping) - Formatter options
- [Plugin Equivalents](#plugin-equivalents) - Common ESLint plugins
- [Manual Migration Steps](#manual-migration-steps) - Step-by-step guide
- [Post-Migration Cleanup](#post-migration-cleanup) - Files to remove
- [Troubleshooting](#troubleshooting) - Common issues

## Migration Overview

**What Biome replaces:**
- ESLint (linting)
- Prettier (formatting)
- eslint-plugin-import (import sorting)
- Various ESLint plugins (~80% coverage)

**What Biome does NOT replace:**
- GraphQL linting/formatting (use graphql-eslint)
- Framework-specific plugins not yet supported
- Custom ESLint rules (must rewrite or disable)

## Automated Migration

### Migrate ESLint Config

```bash
# Migrate and write to biome.json
bunx @biomejs/biome migrate eslint --write

# Preview without writing
bunx @biomejs/biome migrate eslint

# Include eslintignore
bunx @biomejs/biome migrate eslint --include-inspired --write
```

**Supported ESLint formats:**
- `.eslintrc.js` / `.eslintrc.cjs`
- `.eslintrc.json`
- `eslint.config.js` (flat config)
- `.eslintignore`

**NOT supported:**
- `.eslintrc.yaml` / `.eslintrc.yml`
- Inline config comments (must remove manually)

### Migrate Prettier Config

```bash
# Migrate and write to biome.json
bunx @biomejs/biome migrate prettier --write

# Preview without writing
bunx @biomejs/biome migrate prettier
```

**Supported Prettier formats:**
- `.prettierrc`
- `.prettierrc.json`
- `prettier.config.js`
- `.prettierignore`

**NOT supported:**
- `.prettierrc.yaml`
- `.prettierrc.toml`

## ESLint Rule Mapping

### Naming Convention Change

```
ESLint:  kebab-case-rule-name
Biome:   camelCaseRuleName

ESLint:  no-unused-vars
Biome:   noUnusedVariables

ESLint:  @typescript-eslint/no-explicit-any
Biome:   noExplicitAny (no prefix needed)
```

### Common Rule Mappings

| ESLint | Biome |
|--------|-------|
| `no-unused-vars` | `noUnusedVariables` |
| `no-undef` | `noUndeclaredVariables` |
| `no-console` | `noConsoleLog` |
| `no-debugger` | `noDebugger` |
| `eqeqeq` | `noDoubleEquals` |
| `prefer-const` | `useConst` |
| `no-var` | `noVar` |
| `no-empty` | `noEmptyBlockStatements` |
| `no-duplicate-imports` | (organize imports) |

### TypeScript ESLint Mappings

| @typescript-eslint | Biome |
|-------------------|-------|
| `no-explicit-any` | `noExplicitAny` |
| `no-non-null-assertion` | `noNonNullAssertion` |
| `consistent-type-imports` | `useImportType` |
| `consistent-type-exports` | `useExportType` |
| `no-unused-vars` | `noUnusedVariables` |
| `no-inferrable-types` | `noInferrableTypes` |

### React/JSX Mappings

| eslint-plugin-react | Biome |
|--------------------|-------|
| `jsx-key` | `useJsxKeyInIterable` |
| `jsx-no-comment-textnodes` | `noCommentText` |
| `no-children-prop` | `noChildrenProp` |
| `self-closing-comp` | `useSelfClosingElements` |

## Prettier Setting Mapping

| Prettier | Biome | Notes |
|----------|-------|-------|
| `tabWidth` | `indentWidth` | Same |
| `useTabs` | `indentStyle` | `true` → `"tab"` |
| `printWidth` | `lineWidth` | Same |
| `semi` | `semicolons` | `true` → `"always"` |
| `singleQuote` | `quoteStyle` | `true` → `"single"` |
| `jsxSingleQuote` | `jsxQuoteStyle` | `true` → `"single"` |
| `trailingComma` | `trailingCommas` | Same values |
| `bracketSpacing` | `bracketSpacing` | Same |
| `arrowParens` | `arrowParentheses` | Same values |
| `endOfLine` | `lineEnding` | Same values |

### Conversion Example

**Before (Prettier):**
```json
{
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 100,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true
}
```

**After (Biome):**
```json
{
  "formatter": {
    "indentWidth": 2,
    "indentStyle": "space",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "semicolons": "always",
      "quoteStyle": "single",
      "trailingCommas": "all",
      "bracketSpacing": true
    }
  }
}
```

## Plugin Equivalents

### Supported Plugins (partial coverage)

| Plugin | Biome Coverage | Notes |
|--------|---------------|-------|
| @typescript-eslint | ~90% | Most rules supported |
| eslint-plugin-react | ~80% | JSX rules supported |
| eslint-plugin-react-hooks | ~70% | Basic rules |
| eslint-plugin-jsx-a11y | ~80% | a11y group |
| eslint-plugin-unicorn | ~50% | Selected rules |
| eslint-plugin-import | ~60% | organize imports |

### Not Supported Plugins

| Plugin | Alternative |
|--------|-------------|
| eslint-plugin-svelte | Use svelte-check |
| eslint-plugin-graphql | Keep using ESLint |
| eslint-plugin-tailwindcss | Biome nursery/useSortedClasses |
| eslint-plugin-prettier | Not needed |

## Manual Migration Steps

### Step 1: Install Biome

```bash
bun add -D -E @biomejs/biome
bunx biome init
```

### Step 2: Run Automated Migration

```bash
# Migrate both ESLint and Prettier
bunx @biomejs/biome migrate eslint --write
bunx @biomejs/biome migrate prettier --write
```

### Step 3: Review Generated Config

Check `biome.json` for:
- Rules that couldn't be migrated (logged as warnings)
- Settings that need adjustment
- Missing plugin equivalents

### Step 4: Add Svelte Overrides

```json
{
  "overrides": [
    {
      "include": ["*.svelte"],
      "linter": {
        "rules": {
          "style": { "useConst": "off" },
          "correctness": { "noUnusedVariables": "off" }
        }
      }
    }
  ]
}
```

### Step 5: Update Scripts

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

### Step 6: Update VS Code Settings

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "eslint.enable": false
}
```

### Step 7: Test

```bash
# Check everything
bunx biome check .

# Fix auto-fixable issues
bunx biome check --write .
```

## Post-Migration Cleanup

### Files to Remove

```bash
# ESLint files
rm .eslintrc.js .eslintrc.json .eslintrc.cjs
rm .eslintignore
rm eslint.config.js

# Prettier files
rm .prettierrc .prettierrc.json
rm .prettierignore
rm prettier.config.js

# Remove packages
bun remove eslint prettier eslint-config-prettier
bun remove @typescript-eslint/eslint-plugin @typescript-eslint/parser
bun remove eslint-plugin-svelte eslint-plugin-import
# ... remove all eslint-* and prettier-* packages
```

### VS Code Extensions

- Disable or uninstall ESLint extension
- Disable or uninstall Prettier extension
- Install Biome extension

## Troubleshooting

### "Unknown rule" warnings

Some ESLint rules don't have Biome equivalents. Options:
1. Ignore if not critical
2. Find alternative Biome rule
3. Keep ESLint for that specific rule only

### Formatting differences

Biome is 97% Prettier-compatible. Known differences:
- Object property quoting (Biome quotes less)
- Parentheses in complex expressions
- Some edge cases with ternaries

### Import sorting differences

Biome's import sorting groups differently than eslint-plugin-import:
1. Side effects
2. External packages
3. Internal aliases ($lib)
4. Relative imports

### Performance regression

If CI is slower after migration:
- Ensure using `biome ci` not `biome check`
- Check for unnecessary file scanning
- Use `files.ignore` to exclude build outputs

### Mixed Approach

If migration is incomplete, you can run both:

```json
{
  "scripts": {
    "lint": "biome check . && eslint --ext .graphql .",
    "lint:fix": "biome check --write . && eslint --fix --ext .graphql ."
  }
}
```

But this loses most performance benefits.
