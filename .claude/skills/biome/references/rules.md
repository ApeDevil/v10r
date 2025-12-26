# Biome Linter Rules Reference

Complete reference for Biome linter rules organized by group.

## Contents

- [Rule Groups Overview](#rule-groups-overview) - All groups and their purpose
- [Correctness Rules](#correctness-rules) - Likely bugs
- [Suspicious Rules](#suspicious-rules) - Code smells
- [Style Rules](#style-rules) - Consistency
- [Complexity Rules](#complexity-rules) - Simplification
- [Performance Rules](#performance-rules) - Optimization
- [Security Rules](#security-rules) - Vulnerabilities
- [A11y Rules](#a11y-rules) - Accessibility
- [Nursery Rules](#nursery-rules) - Unstable/new
- [Recommended for Velociraptor](#recommended-for-velociraptor) - Project-specific

## Rule Groups Overview

| Group | Purpose | Default |
|-------|---------|---------|
| `correctness` | Catches definite bugs | Most enabled |
| `suspicious` | Code that's likely wrong | Most enabled |
| `style` | Enforces consistent style | Most enabled |
| `complexity` | Simplifies complex code | Some enabled |
| `performance` | Improves runtime performance | Some enabled |
| `security` | Prevents vulnerabilities | All enabled |
| `a11y` | Accessibility best practices | All enabled |
| `nursery` | New/unstable rules | None enabled |

## Correctness Rules

Rules that catch definite bugs.

### Key Rules

| Rule | Description | Default |
|------|-------------|---------|
| `noUnusedVariables` | Disallow unused variables | error |
| `noUnusedImports` | Disallow unused imports | error |
| `noUndeclaredVariables` | Disallow undeclared variables | error |
| `noInvalidConstructorSuper` | Require super() in constructors | error |
| `noConstAssign` | Disallow reassigning const | error |
| `noEmptyPattern` | Disallow empty destructuring | error |
| `noInnerDeclarations` | Disallow function/var in blocks | error |
| `noSelfAssign` | Disallow self-assignment | error |
| `noUnreachable` | Disallow unreachable code | error |
| `noUnreachableSuper` | Require super() before this | error |

### Configuration

```json
{
  "linter": {
    "rules": {
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "noUndeclaredVariables": "error"
      }
    }
  }
}
```

## Suspicious Rules

Rules that catch code smells.

### Key Rules

| Rule | Description | Default |
|------|-------------|---------|
| `noExplicitAny` | Disallow explicit `any` type | warn |
| `noConsoleLog` | Disallow console.log | off |
| `noDebugger` | Disallow debugger statement | error |
| `noDoubleEquals` | Require === over == | error |
| `noEmptyBlockStatements` | Disallow empty blocks | warn |
| `noAsyncPromiseExecutor` | Disallow async Promise executor | error |
| `noConfusingVoidType` | Disallow confusing void usage | warn |
| `noDuplicateObjectKeys` | Disallow duplicate keys | error |
| `noImplicitAnyLet` | Disallow implicit any in let | warn |
| `noShadowRestrictedNames` | Disallow shadowing globals | error |

### Configuration

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsoleLog": "warn",
        "noDebugger": "error"
      }
    }
  }
}
```

## Style Rules

Rules for consistent code style.

### Key Rules

| Rule | Description | Default |
|------|-------------|---------|
| `useConst` | Prefer const over let | error |
| `useTemplate` | Prefer template literals | warn |
| `useShorthandAssign` | Prefer x += 1 over x = x + 1 | warn |
| `noNonNullAssertion` | Disallow ! assertion | warn |
| `noParameterAssign` | Disallow reassigning params | warn |
| `noInferrableTypes` | Disallow obvious type annotations | warn |
| `useExportType` | Prefer export type for types | warn |
| `useImportType` | Prefer import type for types | warn |
| `noDefaultExport` | Prefer named exports | off |
| `useNamingConvention` | Enforce naming conventions | off |

### Configuration

```json
{
  "linter": {
    "rules": {
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn",
        "noParameterAssign": "error",
        "useImportType": "error",
        "useExportType": "error"
      }
    }
  }
}
```

### Svelte Override

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
    }
  ]
}
```

Reason: Svelte 5 runes require `let` for reactive state.

## Complexity Rules

Rules for simpler code.

### Key Rules

| Rule | Description | Default |
|------|-------------|---------|
| `noForEach` | Prefer for...of over forEach | off |
| `noUselessSwitchCase` | Disallow useless switch cases | warn |
| `noUselessTypeConstraint` | Disallow useless extends | warn |
| `noUselessThisAlias` | Disallow useless this alias | warn |
| `noUselessFragments` | Disallow useless <></> | warn |
| `useFlatMap` | Prefer flatMap over map+flat | warn |
| `useOptionalChain` | Prefer ?. over && chains | warn |
| `useSimplifiedLogicExpression` | Simplify boolean logic | warn |

### Configuration

```json
{
  "linter": {
    "rules": {
      "complexity": {
        "noForEach": "off",
        "useOptionalChain": "error",
        "useFlatMap": "warn"
      }
    }
  }
}
```

## Performance Rules

Rules for better performance.

### Key Rules

| Rule | Description | Default |
|------|-------------|---------|
| `noAccumulatingSpread` | Disallow spreading in loops | warn |
| `noDelete` | Disallow delete operator | warn |
| `noReExportAll` | Disallow export * from | off |

### Configuration

```json
{
  "linter": {
    "rules": {
      "performance": {
        "noAccumulatingSpread": "error",
        "noDelete": "warn"
      }
    }
  }
}
```

## Security Rules

Rules for security vulnerabilities.

### Key Rules

| Rule | Description | Default |
|------|-------------|---------|
| `noDangerouslySetInnerHtml` | Disallow dangerouslySetInnerHTML | error |
| `noGlobalEval` | Disallow eval() | error |

### Configuration

```json
{
  "linter": {
    "rules": {
      "security": {
        "noGlobalEval": "error",
        "noDangerouslySetInnerHtml": "error"
      }
    }
  }
}
```

## A11y Rules

Accessibility rules (mostly for JSX/React).

### Key Rules

| Rule | Description | Default |
|------|-------------|---------|
| `noAccessKey` | Disallow accessKey | warn |
| `noAriaUnsupportedElements` | Valid ARIA on elements | warn |
| `noAutofocus` | Disallow autofocus | warn |
| `noBlankTarget` | Require rel with target=_blank | warn |
| `noDistractingElements` | Disallow marquee/blink | warn |
| `noPositiveTabindex` | Disallow positive tabindex | warn |
| `useAltText` | Require alt on images | warn |
| `useButtonType` | Require type on buttons | warn |
| `useHeadingContent` | Require content in headings | warn |
| `useValidAnchor` | Valid anchor elements | warn |

### Configuration

```json
{
  "linter": {
    "rules": {
      "a11y": {
        "useAltText": "error",
        "useButtonType": "error",
        "noBlankTarget": "error"
      }
    }
  }
}
```

## Nursery Rules

Unstable/experimental rules. Must be enabled explicitly.

```json
{
  "linter": {
    "rules": {
      "nursery": {
        "useSortedClasses": "warn"
      }
    }
  }
}
```

**Note:** `useSortedClasses` is for Tailwind CSS class sorting. Does NOT work with UnoCSS custom utilities yet.

## Recommended for Velociraptor

Complete recommended configuration for Velociraptor projects:

```json
{
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
        "noConsoleLog": "warn",
        "noDebugger": "error"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn",
        "useImportType": "error",
        "useExportType": "error"
      },
      "complexity": {
        "useOptionalChain": "error",
        "noForEach": "off"
      },
      "performance": {
        "noAccumulatingSpread": "error"
      }
    }
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
            "noExplicitAny": "off",
            "noConsoleLog": "off"
          }
        }
      }
    },
    {
      "include": ["*.config.ts", "*.config.js", "vite.config.ts"],
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

### Rule Priority Guide

| Priority | Rules | Action |
|----------|-------|--------|
| Critical | correctness/* | Keep as error |
| Important | security/* | Keep as error |
| Recommended | suspicious/* | Mostly warn |
| Team Choice | style/* | Configure per team |
| Optional | complexity/* | Enable as needed |
| Experimental | nursery/* | Test before using |
