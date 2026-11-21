# MCP evolution

How v10r's MCP implementation is assessed against the current Model Context Protocol and kept
current. Research and architecture only (2026-11-21): nothing in this directory is implemented
yet. The implementation it talks about is described in [pattern-mcp.md](../pattern-mcp.md)
(stdio) and [hosted-mcp.md](../hosted-mcp.md) (HTTP); the in-app agent's action architecture in
[agent-actions.md](../../ai/agent-actions.md).

## Files

| File | Answers |
|---|---|
| [state-of-the-art.md](./state-of-the-art.md) | What the 2026-07-28 spec, extensions, roadmap, SDKs, conformance, progressive discovery, programmatic tool calling and Cloudflare Code Mode actually are, each classified stable / extension / guidance / proposal / vendor / experimental |
| [audit.md](./audit.md) | What v10r implements, what is documented, and what was verified running — including official conformance runs and the SDK v2 client against both servers |
| [decision-record.md](./decision-record.md) | The recommended design (D1–D9), alternatives, the rejected ideas, and the threat model for programmatic execution |
| [roadmap.md](./roadmap.md) | Priority A–D items with ids, dependency order and done criteria; the benchmark-harness proposal |
| [process.md](./process.md) | Sources to track, the monthly and event-driven reviews, the conformance lane, how to avoid noise |
| [matrix.md](./matrix.md) | The living compatibility and evolution record (the one file the process updates) |

## Answers

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

## Action plan

1. **A1** fallback version + doc drift — S, no approval needed beyond the go-ahead.
2. **A2** conformance script + baseline, v2-client interop test — S, adds one devDependency.
3. **A3** dual-era 2026-07-28 on both transports — L.
4. **B1** live Claude Code check (ApeDevil, locally) → `title` + `readOnlyHint`.
5. **B2** benchmark harness extension — M, after approval.
6. **C1** light registry record, promoted after A3.

## Decisions that need ApeDevil

1. **Accept the recommended direction** (dual-era, hand-rolled protocol kept, Code Mode
   rejected with revisit triggers) — the [decision record](./decision-record.md) is *proposed*
   until then.
2. **Add `@modelcontextprotocol/client` (v2) as a devDependency** for the interop test (A2).
3. **A3 timing:** start now, or wait until telemetry shows modern-era callers.
4. **B2 scope:** offline harness only, or also a live eval lane with a provider key (costs
   money per run).
5. **B1:** run the Claude Code metadata check locally (cloud sessions cannot).
6. **Monthly review:** whether a scheduled reminder for a cloud session should be set up.
7. **D7:** confirm the operator MCP surfaces stay single-holder (static bearer); per-user MCP
   access would make OAuth a product decision.
