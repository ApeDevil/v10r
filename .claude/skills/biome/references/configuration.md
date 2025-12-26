# Biome Configuration Reference

Complete reference for `biome.json` / `biome.jsonc` configuration.

## Contents

- [Schema](#schema) - JSON schema for validation
- [Top-Level Structure](#top-level-structure) - All root keys
- [VCS Settings](#vcs-settings) - Git integration
- [Files Settings](#files-settings) - Include/exclude patterns
- [Formatter Settings](#formatter-settings) - Global formatter options
- [JavaScript Formatter](#javascript-formatter) - JS/TS specific formatting
- [JSON Formatter](#json-formatter) - JSON formatting options
- [CSS Formatter](#css-formatter) - CSS formatting options
- [Linter Settings](#linter-settings) - Linter configuration
- [Organize Imports](#organize-imports) - Import sorting
- [Overrides](#overrides) - File-specific settings
- [Extends](#extends) - Configuration inheritance

## Schema

Always include the schema for IDE autocompletion:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json"
}
```

## Top-Level Structure

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": {},
  "files": {},
  "formatter": {},
  "javascript": {},
  "json": {},
  "css": {},
  "linter": {},
  "organizeImports": {},
  "overrides": [],
  "extends": []
}
```

## VCS Settings

```json
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main",
    "root": "."
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable VCS integration |
| `clientKind` | string | `"git"` | VCS type (only "git" supported) |
| `useIgnoreFile` | boolean | `false` | Respect `.gitignore` |
| `defaultBranch` | string | `"main"` | Default branch name |
| `root` | string | `"."` | VCS root directory |

## Files Settings

```json
{
  "files": {
    "include": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    "ignore": [
      "dist/**",
      "build/**",
      ".svelte-kit/**",
      "node_modules/**",
      "*.min.js",
      "coverage/**"
    ],
    "ignoreUnknown": false,
    "maxSize": 1048576
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | string[] | All supported | Glob patterns to include |
| `ignore` | string[] | `[]` | Glob patterns to exclude |
| `ignoreUnknown` | boolean | `false` | Ignore unsupported file types |
| `maxSize` | number | `1048576` | Max file size in bytes (1MB) |

## Formatter Settings

Global formatter options apply to all languages:

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf",
    "formatWithErrors": false,
    "ignore": [],
    "include": [],
    "attributePosition": "auto"
  }
}
```

| Option | Type | Default | Values |
|--------|------|---------|--------|
| `enabled` | boolean | `true` | - |
| `indentStyle` | string | `"tab"` | `"tab"`, `"space"` |
| `indentWidth` | number | `2` | 1-24 |
| `lineWidth` | number | `80` | 1-320 |
| `lineEnding` | string | `"lf"` | `"lf"`, `"crlf"`, `"cr"` |
| `formatWithErrors` | boolean | `false` | Format even with syntax errors |
| `attributePosition` | string | `"auto"` | `"auto"`, `"multiline"` |

## JavaScript Formatter

```json
{
  "javascript": {
    "formatter": {
      "enabled": true,
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "quoteProperties": "asNeeded",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always",
      "bracketSpacing": true,
      "bracketSameLine": false,
      "attributePosition": "auto"
    },
    "parser": {
      "unsafeParameterDecoratorsEnabled": false
    },
    "globals": ["$state", "$derived", "$effect", "$props", "$bindable"]
  }
}
```

| Option | Type | Default | Values |
|--------|------|---------|--------|
| `quoteStyle` | string | `"double"` | `"single"`, `"double"` |
| `jsxQuoteStyle` | string | `"double"` | `"single"`, `"double"` |
| `quoteProperties` | string | `"asNeeded"` | `"asNeeded"`, `"preserve"` |
| `trailingCommas` | string | `"all"` | `"all"`, `"es5"`, `"none"` |
| `semicolons` | string | `"always"` | `"always"`, `"asNeeded"` |
| `arrowParentheses` | string | `"always"` | `"always"`, `"asNeeded"` |
| `bracketSpacing` | boolean | `true` | Space in `{ foo }` |
| `bracketSameLine` | boolean | `false` | JSX `>` on same line |

### Svelte Globals

Add Svelte 5 runes to globals to prevent undefined errors:

```json
{
  "javascript": {
    "globals": ["$state", "$derived", "$effect", "$props", "$bindable", "$inspect"]
  }
}
```

## JSON Formatter

```json
{
  "json": {
    "formatter": {
      "enabled": true,
      "indentStyle": "tab",
      "indentWidth": 2,
      "lineWidth": 80,
      "lineEnding": "lf",
      "trailingCommas": "none"
    },
    "parser": {
      "allowComments": true,
      "allowTrailingCommas": true
    }
  }
}
```

## CSS Formatter

```json
{
  "css": {
    "formatter": {
      "enabled": true,
      "indentStyle": "tab",
      "indentWidth": 2,
      "lineWidth": 80,
      "lineEnding": "lf",
      "quoteStyle": "double"
    },
    "linter": {
      "enabled": true
    }
  }
}
```

## Linter Settings

```json
{
  "linter": {
    "enabled": true,
    "ignore": [],
    "include": [],
    "rules": {
      "recommended": true,
      "all": false,
      "correctness": {},
      "suspicious": {},
      "style": {},
      "complexity": {},
      "performance": {},
      "security": {},
      "a11y": {},
      "nursery": {}
    }
  }
}
```

### Rule Configuration

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
        "useConst": {
          "level": "error",
          "fix": "safe"
        }
      }
    }
  }
}
```

Rule values:
- `"error"` - Report as error
- `"warn"` - Report as warning
- `"off"` - Disable rule
- `{ "level": "error", "fix": "safe" }` - With options

Fix types:
- `"safe"` - Always safe to apply
- `"unsafe"` - May change behavior

## Organize Imports

```json
{
  "organizeImports": {
    "enabled": true,
    "ignore": [],
    "include": []
  }
}
```

Import order (automatic):
1. Side-effect imports: `import './styles.css'`
2. Type imports: `import type { Foo } from 'bar'`
3. External: `import { foo } from 'package'`
4. Internal: `import { bar } from '$lib/utils'`
5. Relative: `import { baz } from './local'`

## Overrides

Apply different settings to specific files:

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
    },
    {
      "include": ["*.test.ts", "*.spec.ts", "**/__tests__/**"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    },
    {
      "include": ["*.config.ts", "*.config.js"],
      "linter": {
        "rules": {
          "style": {
            "noDefaultExport": "off"
          }
        }
      }
    }
  ]
}
```

## Extends

Inherit from other configurations:

```json
{
  "extends": ["./biome.base.json"]
}
```

**Shared base config pattern:**

```json
// biome.base.json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": {
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "linter": {
    "rules": {
      "recommended": true
    }
  }
}

// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["./biome.base.json"],
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

## Complete Velociraptor Configuration

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
      "*.min.js",
      "coverage/**",
      "drizzle/**"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    },
    "globals": ["$state", "$derived", "$effect", "$props", "$bindable", "$inspect"]
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsoleLog": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn"
      }
    }
  },
  "organizeImports": {
    "enabled": true
  },
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
