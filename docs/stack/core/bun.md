# Bun

JavaScript runtime. Fastest available, built-in bundler, native TypeScript.

## Why Bun

| Aspect | Bun | Node.js | Deno |
|--------|-----|---------|------|
| Speed | Fastest | Baseline | Fast |
| TypeScript | Native | Requires transpile | Native |
| Bundler | Built-in | External (esbuild, etc.) | External |
| Package Manager | Built-in (fastest) | npm/yarn/pnpm | npm-compatible |
| Node Compatibility | High | N/A | Partial |

Bun wins: fastest runtime, native TS, built-in tooling, Node-compatible.

## Stack Integration

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Bun** | Fastest JS runtime, built-in bundler, native TypeScript |
| Framework | SvelteKit | Bun-compatible via adapters |
| Adapter | `svelte-adapter-bun` | Native Bun server for containers |
| Package Manager | `bun install` | Faster than npm/yarn/pnpm |

## Development

```bash
bun install          # Install dependencies
bun run dev          # Start dev server
bun run build        # Production build
bun run preview      # Preview production build
```

## Container Deployment

Use `oven/bun:alpine` base image (~50MB). See [ops/deployment.md](../ops/deployment.md).

## Related

- [sveltekit.md](./sveltekit.md) - Framework integration
- [podman.md](./podman.md) - Container setup
- [../ops/deployment.md](../ops/deployment.md) - Deployment targets
