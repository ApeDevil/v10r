/**
 * v10r Pattern MCP — the stdio entry every MCP client registration points at.
 *
 *   podman run -i --rm --network=none -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
 *
 * The server is the official MCP SDK's, wired up in `stdio-server.ts`. The container mounts the
 * repo read-only and has no node_modules, so this entry imports nothing that needs installing: it
 * starts the self-contained bundle built from `stdio-server.ts` (`bun run mcp:bundle:build`, kept
 * current by `mcp:bundle:check` in the gate). One implementation, one stable path — registrations
 * made before the SDK migration keep working unchanged.
 *
 * The import path is a runtime value so type checkers never descend into the generated bundle;
 * the type comes from the source it was built from.
 */
import type { startStdioServer } from './stdio-server.ts';

const bundle = new URL('./server.bundle.js', import.meta.url).href;
const entry = (await import(bundle)) as { startStdioServer: typeof startStdioServer };
entry.startStdioServer();
