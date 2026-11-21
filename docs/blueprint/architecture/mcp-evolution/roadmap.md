# MCP evolution roadmap

Prioritised, dependency-ordered changes that follow from the [decision record](./decision-record.md).
**Nothing here is implemented.** Each item lists what changes, why, whether it exists, its
standard status, fit, cost, compatibility and security, measurable benefit, verification and
timing. Item ids (A1, B2, …) are stable so the [matrix](./matrix.md) can cite them.

Complexity: **S** ≤ half a day · **M** 1–2 days · **L** > 2 days.

---

## Priority A — standards and correctness

### A1 — Fix the negotiated fallback version and doc drift · S · now

- **What.** `DEFAULT_PROTOCOL_VERSION` → latest supported (`2025-11-25`), one constant shared
  by both transports (stdio imports it or a parity test pins it). Correct "six" → "eight" tools
  and the surface count in `hosted-mcp.md`, `pattern-mcp.md` and the architecture hub; rerun
  `mcp:bench --write` so `results.json` matches the tree.
- **Why.** Spec SHOULD; the transports disagree today ([audit](./audit.md) §2, §8).
- **Exists.** Partially (stdio already correct). **Standard.** Stable (2025-11-25 lifecycle).
- **Compatibility.** A client asking for an unknown version gets 2025-11-25 instead of
  2025-06-18 — every client that handles negotiation accepts any supported answer.
  `served_protocol_version` telemetry stops over-reporting 2025-06-18 (as `call-log.ts` notes).
- **Verify.** Unit test in `http.test.ts` + a parity case asserting both transports answer the
  same version; conformance `server-initialize`.

### A2 — Conformance and compatibility lane · S · now

- **What.** A script (`scripts/mcp/conformance.ts`) that starts nothing itself and runs
  `npx @modelcontextprotocol/conformance@<pinned>` against a given URL with a committed
  expected-failures baseline (`mcp/conformance-baseline.yml`) listing the not-applicable fixture
  scenarios by name with a one-line reason each. Add a second interop case to
  `sdk-interop.test.ts` using `@modelcontextprotocol/client` v2 in `auto` mode (asserts the
  probe → 400 → `initialize` fallback seen in [audit](./audit.md) §7.3) and in `legacy` mode.
  Optional `bun run mcp:conformance` script; **not** added to `validate` (it needs a running
  server and the network).
- **Why.** Regression detection for dependency updates and protocol evolution; makes the
  forward-compatibility guard tested against the real modern client.
- **Exists.** No. **Standard.** Official tooling.
- **Dependencies.** Adds `@modelcontextprotocol/client` as a **devDependency** — needs approval.
- **Verify.** Baseline run green on 2025-11-25; the v2 test fails if the 400 body shape changes.

### A3 — Dual-era 2026-07-28 support · L · after A1, A2

- **What.** The modern path of D1 on both transports: `server/discover`; `_meta` validation
  (protocolVersion, clientCapabilities required; clientInfo optional); `Mcp-Method`/`Mcp-Name`
  agreement (with OWS trimming and Base64 sentinel decoding) → 400/-32020; -32022 with
  `data.supported` for unknown versions on the modern path; `resultType: "complete"` on every
  result; `ttlMs` + `cacheScope: "public"` on `server/discover` and `tools/list` (registry
  version in the result means a long TTL is safe; admin surface `private`);
  `_meta["io.modelcontextprotocol/serverInfo"]`; unknown and removed methods (`ping`,
  `logging/setLevel`, `initialize` on the modern path) → 404/-32601; error responses carry the
  request id. Legacy path unchanged. Retire the plain-400 guard *in the same change*, as its
  comment requires; keep the plain body for legacy-only failure cases the spec still covers.
- **Why.** Current stable standard; the conformance shopping list in [audit](./audit.md) §7.2.
- **Fit.** Transport layer only; `QUERY_TOOLS`/`REGISTRY_QUERIES` and all handlers unchanged;
  `mcp.call_log` enums already pre-seed `server/discover`.
- **Compatibility.** Legacy clients see no change (pinned by the existing suites + A2's
  `legacy` case). Modern `auto` clients connect without the extra 400 round trip.
- **Security.** Header/body agreement removes a telemetry spoofing gap (`toolName` from
  `Mcp-Name` becomes trustworthy only after validation). No state handles are introduced, so
  state-handle hijacking stays moot.
- **Measurable benefit.** −1 round trip per modern-client connection; conformance
  `server-stateless`, `http-header-validation`, `caching`, `tools-*` pass on 2026-07-28.
- **Verify.** Conformance 2026-07-28 (pinned alpha or the first stable 0.2.x) with a baseline
  for fixture scenarios; SDK v2 client in `{ pin: '2026-07-28' }` mode; parity test across
  transports for both eras; telemetry shows `rc_headers` rows served modern.
- **Timing.** Now-ish: start after A1/A2; it is not urgent (legacy fallback works) but it is the
  standard. Out of scope: MRTR, `subscriptions/listen`, Tasks — v10r has no input-requiring or
  long-running tool, so they are **not applicable** rather than missing.

## Priority B — proven optimizations

### B1 — Re-verify the Claude Code metadata bug; adopt `title` + `readOnlyHint` · S · after a live check

- **What.** ApeDevil runs the stdio server and the hosted endpoint in a current Claude Code with
  one tool carrying `title` and `annotations: { readOnlyHint: true }`. If the tool list survives,
  add both to all public tools (and `destructiveHint`/`idempotentHint` where true on admin) and
  extend `smoke.ts` to assert the fields are accepted.
- **Why.** Spec-recommended metadata, clients can auto-approve read-only tools.
- **Benefit.** Fewer permission prompts in clients that honour `readOnlyHint` (observable,
  not token-measurable). Cost ≈ +15 tokens per tool in `tools/list`.
- **Timing.** Later, gated on the live check (cloud sessions cannot run Claude Code against
  itself).

### B2 — Benchmark harness for interface strategies · M · proposal, approve before building

The brief asks for five strategies compared on real scenarios. The existing harness
(`scripts/mcp/retrieval-bench.ts`, `pattern-library/bench/workflows.json`) already measures
strategies 1 and 2 deterministically. Proposed changes, all offline and deterministic:

1. **Report tool-definition tokens per workflow** (today a single `toolsList` figure) so total
   cost = definitions + calls + results.
2. **Add an `intermediateTokens` column** (all results but the last) — the ceiling of what any
   programmatic strategy can save; computed by hand in [audit](./audit.md) §5.
3. **A `code-mode` variant model**: definitions = generated TypeScript declarations of the
   tools (instead of JSON schemas) + per-workflow script tokens (the script text is committed in
   `workflows.json`) + final output only. Deterministic, oracle-driven, like the existing ones.
4. **A `discovery` variant model**: a `search_tools` call (≈ name + one line per tool) + the
   `inputSchema` of the chosen tool, instead of all definitions.
5. **A synthetic catalogue scale** (8 → 32 → 128 → 512 tools, generated by cloning the real
   tools with distinct names/descriptions) to find the crossover where 3 and 4 beat 1 — so the
   D4/D5 revisit triggers are measured, not asserted.
6. **Hybrid** = choose per task: direct if definitions < threshold and calls ≤ 2, else 3/4.

What it **cannot** measure offline: model round trips actually taken, tool-selection accuracy,
generated-code failure rate, latency through a real client. Those need a **live eval lane**
(provider key, a model, real cost per run) — a separate decision for ApeDevil. v10r's
`src/lib/server/ai/eval/` is the natural home if approved.

- **Exists.** Strategies 1–2 yes; 3–6 no. **Dependencies.** None. **Timing.** After approval;
  it is what any future Code Mode proposal must cite.

### B3 — Long `ttlMs` on the public surface · S · with A3

Covered by A3, called out because it is the one 2026-07-28 feature with a direct efficiency
effect: a client honouring `ttlMs` skips `tools/list` on reconnect. Measure with telemetry
(`tools/list` rows per client family before/after).

## Priority C — optional enhancements

### C1 — Registry record for the evolution practice · S · with this branch's acceptance

Add a **light** record `architecture-mcp-evolution` to `pattern-library/registry.json`
(category `architecture`, docs → this directory, code → `src/lib/server/mcp`, `mcp`), run
`bun run patterns:validate` and `bun run patterns:build` to regenerate the README index and
`docs/pattern-library/` page, then `mcp:excerpts:build`. Promote to deep (invariants: dual-era,
conformance baseline, monthly review) only after A2/A3 exist. Never hand-edit the generated page.

### C2 — `outputSchema` + `structuredContent` · M · later

Only when (a) the roadmap's tool-result-shape work lands and (b) Claude Code renders text
alongside structured content. Enables typed programmatic consumption by clients' own code modes.
Would require both transports and the parity test to carry two bodies.

### C3 — Skills-over-MCP experiment · M · later

Expose deep pattern cards as Skills via `ext-skills` once the extension contract settles —
pattern cards are already skill-shaped (when to use, invariants, entry points). Experiment on
the private surface first.

### C4 — WWW-Authenticate and docs for the bearer realms · S · anytime

State the spec-external static-bearer choice in `hosted-mcp.md` §Security posture, with the
revisit trigger from D7. No code change needed beyond optional wording.

## Priority D — monitor

| Item | Status | Watch for |
|---|---|---|
| Server-side progressive discovery | Roadmap (experimental) | A spec'd method; a catalogue > 40 tools |
| Tool result shape redesign | Roadmap | Unblocks C2 |
| Annotations deprecation (SEP-2200) | Proposal | Decides whether B1 is worth keeping |
| ETags for results | Roadmap | Would let `get_pattern` results be cached by registry version |
| Tasks extension → core | Extension / roadmap | Only if a long-running tool appears |
| MCP Apps | Extension | A Studio result that a card cannot express |
| DPoP, workload identity, CIMD | Roadmap / stable SHOULD | A second holder of an operator surface (D7) |
| Cloudflare Code Mode, Anthropic PTC (still excludes MCP connector tools) | Vendor, experimental | D4 triggers; a portable non-Workers executor |
| Conformance 0.2.x stable | Official tooling | Switch A2/A3 pin from alpha |
| TS SDK v1 end of support (≥ 2027-01-27) | Official | Move the interop test to v2-only |

## Rejected

See [decision-record.md](./decision-record.md) §4. In short: a Code Mode server, generic
`eval`, server-side tool-search meta-tools, a second registry, SDK rewrite of stdio, sessions,
Tasks for fast tools, OAuth for one-user surfaces, dependency bots, an MCP client inside the
in-app agent.

---

## Dependency order

```
A1 fix fallback + doc drift ──┐
A2 conformance lane + v2 test ┼──► A3 dual-era 2026-07-28 (incl. B3 ttlMs) ──► C1 promote record to deep
C1 light registry record ─────┘                │
B2 benchmark harness (approval) ───────────────┴──► (any future D4/D5 revisit)
B1 live Claude Code check ──► title/readOnlyHint
C2, C3 wait on roadmap items in D
```

## Validation criteria for "done"

| Item | Done when |
|---|---|
| A1 | Both transports answer `2025-11-25` to an unknown version; docs say eight tools; `results.json` regenerated |
| A2 | `bun run mcp:conformance <url>` exits 0 with the baseline; v2-client `auto` and `legacy` cases pass in `bun run test` |
| A3 | Conformance 2026-07-28 passes every applicable scenario; legacy suites unchanged; SDK v2 `pin` mode connects; parity holds per era |
| B1 | A recorded live Claude Code session with the fields present; `smoke.ts` asserts them |
| B2 | `mcp:bench` prints all six strategy rows per workflow and the catalogue-scale crossover |
| C1 | `patterns:validate`, `patterns:check`, `mcp:excerpts:check` green with the new record |
