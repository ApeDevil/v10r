# MCP evolution

How v10r's MCP implementation is assessed against the current Model Context Protocol and kept
current. Researched and decided 2026-11-21; the accepted items are implemented on both
transports — see the status table below. The implementation is described in
[pattern-mcp.md](../pattern-mcp.md) (stdio, §Protocol eras) and [hosted-mcp.md](../hosted-mcp.md)
(HTTP, §Protocol eras); the in-app agent's action architecture in
[agent-actions.md](../../ai/agent-actions.md). [audit.md](./audit.md) and the answers below record
the state *before* the implementation, and stay as the baseline it was measured against.

## Status (2026-11-21)

| Item | State | Evidence |
|---|---|---|
| A1 fallback version, doc drift, bench snapshot | Done | both transports answer `2025-11-25` to an unknown version (the SDK's fallback since D10) |
| A2 conformance lane, SDK v2 interop | Done | `bun run mcp:conformance`; `sdk-interop.test.ts` (v1; v2 `legacy`/`auto`/`pin`; stdio and HTTP) |
| A3 dual-era 2026-07-28, both transports (incl. B3 `ttlMs`) | Done | conformance 2026-07-28: every scored scenario v10r can exercise passes; baseline = unadvertised capabilities and fixture tools only |
| B1 `title` / `readOnlyHint` | Pending ApeDevil's local run; fields stay off | [claude-code-compat.md](./claude-code-compat.md) |
| B2 strategy benchmark (offline) | Done | `mcp:bench` → `strategies`, `catalogueScale` in `pattern-library/bench/results.json`; findings in the decision record D4–D5 |
| C1 registry record | Done | `mcp-protocol-evolution` (deep, proven) |
| Monthly review | Approved practice, no automation | [process.md](./process.md) (now includes the SDK bump check) |
| D10 official SDK v2 on every endpoint | On branch `claude/cloud/mcp-official-sdk`, awaiting ship | decision record D10; the hand-written protocol modules are removed |

## Files

| File | Answers |
|---|---|
| [state-of-the-art.md](./state-of-the-art.md) | What the 2026-07-28 spec, extensions, roadmap, SDKs, conformance, progressive discovery, programmatic tool calling and Cloudflare Code Mode actually are, each classified stable / extension / guidance / proposal / vendor / experimental |
| [audit.md](./audit.md) | What v10r implements, what is documented, and what was verified running — including official conformance runs and the SDK v2 client against both servers |
| [decision-record.md](./decision-record.md) | The recommended design (D1–D9), alternatives, the rejected ideas, and the threat model for programmatic execution |
| [roadmap.md](./roadmap.md) | Priority A–D items with ids, dependency order and done criteria; the benchmark-harness proposal |
| [process.md](./process.md) | Sources to track, the monthly and event-driven reviews, the conformance lane, how to avoid noise |
| [matrix.md](./matrix.md) | The living compatibility and evolution record (the one file the process updates) |
| [claude-code-compat.md](./claude-code-compat.md) | The isolated, local Claude Code check that gates tool `title` and `readOnlyHint` (B1) |

## Answers (as researched, before the implementation)

**1. How modern is v10r's MCP implementation?** Fully current for the *previous* revision
(2025-11-25) and unusually well engineered around it: stateless by design, hard per-surface
allowlists, measured result-level progressive disclosure, thorough telemetry, and a
forward-compatibility guard that verifiably makes the newest SDK client fall back cleanly. It
does not implement the *current* revision (2026-07-28). One defect: the hosted transport
negotiates `2025-06-18` instead of the latest for unknown versions.

**2. Which official changes are not implemented or verified?** Not implemented: `server/discover`,
the per-request `_meta` envelope, `Mcp-Method`/`Mcp-Name` validation, `resultType`, `ttlMs`/
`cacheScope`, the -32020…-32022 errors with their 400/404 statuses, extensions negotiation.
Not applicable: MRTR, `subscriptions/listen`, Tasks. Not re-verified: the Claude Code bug that
keeps `title`/`annotations`/`outputSchema` out of tool definitions. Not tested in the gate: the
official conformance suite and the v2 SDK client.

**3. Does Cloudflare Code Mode help v10r's current use cases?** No, measurably. The tool list is
≈ 2,360 tokens; six of eight benchmark tasks finish in one call; the most any script could keep
out of context is ≈ 1,450 tokens across all eight, before paying for the script. It would also
need a sandbox v10r's runtimes do not have.

**4. Should progressive discovery and programmatic tool calling be supported independently?**
They are independent concerns and both belong to the client. v10r supports them the server's
way: a small, well-described catalogue, bounded results with detail levels (already done), and
later `outputSchema` so client-generated code can consume results. No server-side meta-tools.

**5. Adopt now, defer what?** Now: fix the fallback version and doc drift (A1), add the
conformance lane and a v2-client interop test (A2), then dual-era 2026-07-28 support (A3).
Later: `title`/`readOnlyHint` after a live client check (B1), a benchmark harness for the five
strategies (B2), a registry record (C1). Defer: `outputSchema`, Skills, Tasks, Apps, OAuth.
Reject: a Code Mode server, code execution in the in-app agent, tool-search meta-tools.

**6. Can it all fit the existing architecture without a redundant subsystem?** Yes. Every
adopted item lands in the existing transport layer over the one `QUERY_TOOLS`/`REGISTRY_QUERIES`
contract; the era is an envelope, not a second registry. The in-app agent stays on
`TOOL_MANIFEST` and its approval gate; nothing bridges the two.

**7. How is compatibility maintained with minimal effort?** A ≈ 30-minute monthly review over a
fixed list of primary sources, an event-driven review for new revisions and advisories, one
living matrix, and a pinned official conformance run with a baseline — no bots, no scheduled
infrastructure ([process.md](./process.md)).

## Action plan (as proposed)

1. **A1** fallback version + doc drift — S, no approval needed beyond the go-ahead.
2. **A2** conformance script + baseline, v2-client interop test — S, adds one devDependency.
3. **A3** dual-era 2026-07-28 on both transports — L.
4. **B1** live Claude Code check (ApeDevil, locally) → `title` + `readOnlyHint`.
5. **B2** benchmark harness extension — M, after approval.
6. **C1** light registry record, promoted after A3.

## Decisions (ApeDevil, 2026-11-21)

D1–D3 accepted, D4–D5 accepted (no Code Mode, no sandboxed execution, no server-side discovery
wrappers; revisit triggers kept), B2 approved offline only (no paid live evaluations or provider
keys), B1 pending a local check, D7–D9 accepted provisionally, C1 approved, the monthly review
approved as an engineering practice with no new infrastructure.
