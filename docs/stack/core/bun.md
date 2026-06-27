# Bun

The runtime — single executable bundling runtime, package manager, bundler, and test runner; native TypeScript, no transpile step. Lives inside the v10r container, never on the host. See CLAUDE.md "Local Development" for the container-first rule.

## Why was it chosen?

- Native `.ts` execution and a built-in test runner — fewer dev dependencies inside the container.

## Known limitations

**SvelteKit dev gotcha (load-bearing):**
- Vite dev server runs Node-compat under `bun run dev` (Bun as script runner). The `bun --bun run dev` mode (Vite on Bun's runtime) is **disabled** — [oven-sh/bun#23523](https://github.com/oven-sh/bun/issues/23523), a known Vite restart hang. Production SSR runs on the Node.js 22 Vercel runtime (`adapter-vercel`, `runtime: 'nodejs22.x'`); Bun runs the build and the local dev container. A Bun production target (adapter-bun / Vercel `bunVersion`) is blueprint-only, not wired.
- `svelte-adapter-bun` is community-maintained; ORIGIN header isn't passed correctly (breaks form CSRF). Fallback: `adapter-node` via a single config change.

**Node.js API gaps:** `node:http2` server, `node:cluster`, `node:inspector`, `node:repl`, `node:sqlite` missing or partial. Packages relying on Node internals may fail.

## Related

- [sveltekit.md](./sveltekit.md) - Framework integration
- [podman.md](./podman.md) - Container setup
- [../ops/deployment.md](../ops/deployment.md) - Deployment targets
