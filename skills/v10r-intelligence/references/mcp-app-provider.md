# MCP App provider

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** deep · **Maturity:** implemented · **Risk:** low — read-only data the public MCP already serves; the host's sandbox is the enforcement point

Serve one read-only MCP tool with a ui:// View through the official ext-apps helpers: a self-contained, network-less HTML View built apart from the app, linked by _meta.ui, with a complete text and structuredContent answer for hosts that render no View. The View reuses the tool's own data and the host's theme; it holds no authority of its own.

**When to use:** Use when a tool's answer is easier to explore than to read, such as a graph or a filterable list, and the hosts in your audience render MCP Apps.

**Needs:** required key-value-store (via rate-limiting)

## Avoid when

- Your audience is CLI agents only: they get the text, so build the text answer and skip the View
- The View would need network access, credentials or writes: keep those behind your own app's approval flow

## Alternatives

- **A generative surface in your own chat** — prefer when the interaction happens inside your app rather than in third-party MCP hosts

## Docs

- `docs/blueprint/ai/mcp-apps.md` — Decision, implementation, security model, host evidence, deferred host requirements ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/mcp-apps.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/mcp-apps.md))

## Code

- `src/lib/server/mcp/apps//` — The explore_patterns tool and its View on the hosted MCP ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/mcp/apps/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/mcp/apps/))
- `pattern-library/dependency-explorer.ts` — The pure graph projection the tool and the View share ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/dependency-explorer.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/dependency-explorer.ts))
- `scripts/mcp/build-app-views.ts` — Builds the self-contained View document (mcp:apps:build / mcp:apps:check) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/mcp/build-app-views.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/mcp/build-app-views.ts))

## Tests

- `src/lib/server/mcp/apps/pattern-explorer.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/apps/pattern-explorer.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/apps/pattern-explorer.test.ts))
- `pattern-library/dependency-explorer.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/dependency-explorer.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/dependency-explorer.test.ts))

## Proof

- [`/showcases/interop`](https://www.v10r.dev/showcases/interop) — Agentic Interoperability Lab — the MCP Apps row records the host evidence

## Invariants

- The View is read-only and network-less: every CSP list in _meta.ui is empty and it calls only its own tool through the host.
- The text answer and structuredContent are complete on their own; a host that renders no View loses nothing but the interaction.
- The View never ships with the app's client code; it is served only as a ui:// resource.
- A host compatibility claim needs a recorded run in that host.

## Emulation notes

- Claude Code shows the model only structuredContent when both are present, so make structuredContent the full answer.
- Some hosts prepend their own CSP meta, which pushes the View's own meta outside head; the declared _meta.ui CSP is the control that counts.

## Depends on

- [Hosted MCP](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/hosted-mcp.md)

---

_Machine-readable record: `mcp-app-provider` in `pattern-library/registry.json`._
