# MCP evolution process

How v10r keeps its MCP implementation current without a standing project, a bot, or new
infrastructure. The process has one record ([matrix.md](./matrix.md)), two review triggers, one
test lane, and a rule for what counts as a change worth making.

---

## 1. Sources worth tracking

Only primary sources. Everything else (newsletters, vendor blogs) is input to these, not a
substitute.

| Source | What to look at | Why |
|---|---|---|
| [Specification versioning](https://modelcontextprotocol.io/specification/versioning) + the current revision's `changelog` | A new *current* revision; changes in `draft/changelog` | The only normative source |
| [Deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated) | Removal dates | The 12-month lifecycle clock |
| [Roadmap](https://modelcontextprotocol.io/development/roadmap) | "Last updated" date, items moving | Early warning; never adoption |
| [SEPs](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/seps) | SEPs reaching *Accepted* / *Final* in areas the matrix tracks | Accepted SEPs become spec text |
| [TypeScript SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) | v2 minor releases; v1.x security releases | The interop clients and the support window |
| [Conformance releases](https://github.com/modelcontextprotocol/conformance) (npm `@modelcontextprotocol/conformance`) | New scenarios; a stable 0.2.x | The test lane's authority |
| [Security advisories](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories), [spec security best practices](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices), [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/) | New advisories; Top 10 revisions | Event-driven reviews |
| Client changelogs: Claude Code, the Claude MCP connector, Cursor, VS Code | MCP protocol version support; fixes to known bugs (annotations, `structuredContent`) | Decides B1 and C2 in the [roadmap](./roadmap.md) |
| [Cloudflare Agents / Code Mode docs](https://developers.cloudflare.com/agents/tools/codemode/) | A portable executor; stability label dropped | D4 revisit inputs |
| v10r's own telemetry, `/admin/mcp/usage` | `requested_protocol_version`, `rc_headers`, `client_family` shares | The only data about *v10r's* callers |

## 2. Reviews

### Monthly review — ≈ 30 minutes, first working week

A cloud session (or ApeDevil) walks the source list above, then:

1. For each matrix row whose upstream changed, update **Upstream status**, **Evidence**, **Last
   reviewed**. Rows with no upstream change get only their date bumped — or are left alone; a
   stale date is a fact, not a failure.
2. Check telemetry: share of modern-era requests on each surface (`served_protocol_version`
   2026-07-28 rows) and any rise in `unsupported_version` — a client asking for a revision
   v10r does not serve yet is the signal to read the next revision.
3. Run the conformance lane (§3) once against production (`https://www.v10r.dev/api/mcp/public`)
   with the pinned version, and once with the newest runner version to see what is coming.
4. Write down decisions only where something changed: a new row, a priority move, a revisit
   trigger fired. Hand off as a branch, like any other change.

The review is a checklist, not automation (approved 2026-11-21 as an engineering practice): no
scheduled job, runner, bot or monitoring service.

### Event-driven review — within a week of the event

Triggers, and only these:

- A new **current** specification revision.
- A security advisory against `@modelcontextprotocol/*` or a client v10r documents.
- A deprecation whose removal date falls within six months.
- A D4/D5 revisit trigger firing ([decision-record.md](./decision-record.md)).
- A conformance runner release that changes a scenario v10r passes.

An event review does the monthly steps for the affected rows plus a written impact assessment
in the matrix's notes column, and — if code must change — a roadmap item with an id.

## 3. Conformance and regression testing

| Layer | What | Runs | Catches |
|---|---|---|---|
| Unit + gate tests (existing) | `http.test.ts`, `transport.test.ts`, `auth.test.ts`, `http.boundary.gate.test.ts`, `next-actions.gate.test.ts`, `mcp/server.test.ts` | `bun run validate` | Behavioural regressions in v10r code |
| Parity (existing) | `parity.test.ts` — both transports byte-identical | `bun run validate` | One transport drifting |
| SDK interop | v1 client + v2 client in `legacy`, `auto`, `pin`, over HTTP and stdio | `bun run validate` | A dependency update or a body-shape change breaking a real client |
| Stdio smoke (existing) | `mcp/smoke.ts` spawned subprocess | `bun run test:mcp` | Tool-list rejection by strict clients |
| Official conformance | `bun run mcp:conformance [--url …] [--revision …]`, one pinned runner and one baseline per revision (`scripts/mcp/conformance/`) | Monthly review, before a ship that touches `src/lib/server/mcp/` or `mcp/` | Spec drift, including scenarios added upstream |
| Bench (existing) | `bun run mcp:bench --compare` | When tools or results change | Token and relevance regressions |

**Pinning.** The conformance runner version is pinned in the script; the monthly review tries the
newest one and bumps the pin when the baseline holds. The baseline lists not-applicable
scenarios by name with a reason; a new failure is never added to it without a matrix entry
saying why it is not applicable.

**Why not in `validate`.** Conformance needs a running server and the network. Keeping it out of
the always-on gate keeps the gate offline and deterministic, which v10r's cloud sessions depend
on. The in-process SDK interop tests carry the regression protection inside the gate.

## 4. Deciding whether a change is worth making

A new MCP capability moves to *Now* only if one of these holds; otherwise it stays *Monitor*:

1. It is **stable standard** and v10r is non-conformant in a way a conformance scenario detects.
2. It closes a **security** gap named in the official best practices or OWASP Top 10.
3. A **benchmark** in `mcp:bench` (or the live eval lane, if approved) shows a measurable gain
   on v10r's own workflows — not a vendor's.
4. A **client** v10r's callers use (per telemetry) requires it.

And it is rejected if it would add a parallel registry, permission system, orchestrator or
session store, unless the decision record shows the existing one cannot be extended.

## 5. Avoiding maintenance noise

- One record (the matrix). The decision record and roadmap change only when a decision changes.
- No dependency bot: v10r has no CI to attach one to, and the monthly review reads the two SDK
  release pages that matter.
- No scheduled conformance job in infrastructure: the monthly review runs it in a session.
- No notifications and no automated monitoring.
- Dates in the matrix are per row; nobody rewrites the whole file monthly.
