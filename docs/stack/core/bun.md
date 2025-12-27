# Bun

## What is it?

All-in-one JavaScript/TypeScript runtime written in Zig, powered by JavaScriptCore. Ships as a single executable containing runtime, package manager, bundler, and test runner. Drop-in replacement for Node.js.

## What is it for?

- High-performance APIs and HTTP servers
- Serverless functions requiring fast cold starts
- TypeScript services with native .ts execution (no transpile step)
- Development tooling (faster package installation, testing)

## Why was it chosen?

| Aspect | Bun | Node.js |
|--------|-----|---------|
| HTTP throughput | ~52k req/sec | ~13k req/sec |
| Package install | 10-30x faster | Baseline |
| Cold start | 4x faster | Baseline |
| TypeScript | Native | Requires transpile |
| Bundler | Built-in | External tool |

**Key advantages:**
- Fastest JavaScript runtime available
- Native TypeScript without build step
- Built-in tooling reduces dependency count
- High Node.js compatibility for easy migration

**Note:** For database-bound workloads, performance difference is negligible (~5%). Runtime choice matters most for compute-heavy or I/O-heavy operations.

## Known limitations

**Node.js API gaps:**
- `node:http2` server not implemented (client only)
- `node:cluster` limited (workers cannot pass handles)
- `node:inspector`, `node:repl`, `node:sqlite` missing
- Partial: `worker_threads`, `vm`, `crypto`, `child_process`

**SvelteKit-specific:**
- `svelte-adapter-bun` has stalled development
- Known issues with CORS and form handling (ORIGIN not passed correctly)
- Vite dev server still runs on Node.js (only production uses Bun)
- Easy fallback: switch to `adapter-node` with single config change

**Production considerations:**
- Third-party observability tools have limited support
- Packages relying on Node internals may fail
- Enterprise adoption remains cautious vs Node.js maturity

**Mitigation:** Anthropic acquired Bun (December 2024), providing long-term sustainability. Bun remains MIT-licensed and open-source.

## Related

- [sveltekit.md](./sveltekit.md) - Framework integration
- [podman.md](./podman.md) - Container setup
- [../ops/deployment.md](../ops/deployment.md) - Deployment targets
