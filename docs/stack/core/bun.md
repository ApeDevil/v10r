# Bun

The runtime — single executable bundling runtime, package manager, bundler, and test runner; native TypeScript, no transpile step. Lives inside the v10r container, never on the host. See CLAUDE.md "Local Development" for the container-first rule.

## Why was it chosen?

- Native `.ts` execution and a built-in test runner — fewer dev dependencies inside the container.

## Known limitations

**What runs on which engine (load-bearing):**
- The dev container carries a real Node 22 binary ahead of Bun's `node` shim (`Containerfile.dev`), so every `#!/usr/bin/env node` CLI — `vite dev`, `vite build`, `vitest`, `svelte-check`, `paraglide-js` — runs on Node 22, the engine of the Vercel runtime (`adapter-vercel`, `runtime: 'nodejs22.x'`). Bun is the package manager and the runner for `scripts/*.ts` and `mcp/` (`bun test`). Two reasons: production parity (a Node-only `RangeError` in `deadline.ts` shipped unseen while the tests ran on Bun) and Bun's JSC parallel-GC use-after-free — open upstream across 1.3–1.4 ([oven-sh/bun#39587](https://github.com/oven-sh/bun/pull/39587)) — which took `svelte-check` and `vite build` down at multi-GB heaps. Node needs `NODE_OPTIONS=--max-old-space-size=12288` (`compose.yaml`): the client build peaks near 5 GB.
- `bun --bun run dev` (Vite on Bun's runtime) stays **disabled** — [oven-sh/bun#23523](https://github.com/oven-sh/bun/issues/23523), a known Vite restart hang. A Bun production target (adapter-bun / Vercel `bunVersion`) is blueprint-only, not wired.
- `svelte-adapter-bun` is community-maintained; ORIGIN header isn't passed correctly (breaks form CSRF). Fallback: `adapter-node` via a single config change.

**Node.js API gaps:** `node:http2` server, `node:cluster`, `node:inspector`, `node:repl`, `node:sqlite` missing or partial. Packages relying on Node internals may fail.

## Related

- [sveltekit.md](./sveltekit.md) - Framework integration
- [podman.md](./podman.md) - Container setup
- [../ops/deployment.md](../ops/deployment.md) - Deployment targets
