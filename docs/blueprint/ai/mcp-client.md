# MCP client — consuming external tools without a second registry

**Maturity: built, wired to the deskbot** through the external-operations door
([external-operations.md](./external-operations.md)): operator peer directory, disclosure
authorization, persistent claim. Domain, gates, adversarial tests, an interop run against an
independently implemented Python server (20/20) and a PGlite run against the real Python peer
exist on `claude/cloud/agentic-architecture`; no live peer has been used through the UI yet.

## Problem

v10r is an MCP *provider* (`../architecture/mcp-evolution/`). Becoming a *consumer* means
letting other people's tools into turns — tools whose descriptions can carry instructions,
whose annotations can lie, whose results are untrusted, and whose endpoints are server-side
requests (SSRF). The integration must not become a competing tool registry, and an approval
must authorize exactly one call, not a name a peer can redefine.

## Decision

The official `@modelcontextprotocol/client` 2.4.0 (AA3), inside
`src/lib/server/ai/mcp-client/`:

| Piece | File | Rule |
|---|---|---|
| Peer config | `peer.ts` | `McpPeer`: id `[a-z][a-z0-9]{0,23}` (the tool-name namespace — no `-`/`_`, so it is unambiguous), url, auth `none` or bearer by **secret reference** in the `MCP_PEER_SECRET_` namespace, `PeerToolPolicy` (allow, read-only, per-tool `PeerToolRule`), `PeerDisclosurePolicy`, `privateDestinations` |
| Secret isolation | `peer.ts` | A reference outside `MCP_PEER_SECRET_*` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, …) is refused by `peerConfigProblems` **and** resolves to nothing in `environmentSecretResolver` |
| Endpoint guard | `endpoint-guard.ts` | https only (http to a loopback literal only with a test flag a stored config cannot carry); no credentials in URL; **connect-time pinned** address check (below); redirects are errors; only the peer origin; `cookie`/`authorization`/`proxy-authorization` stripped, only the peer's own bearer added — **no token passthrough**; response byte cap |
| Egress policy | `server/http/egress-address.ts`, `pinned-fetch.ts`, `peer-egress.ts` (shared with A2A) | `resolvePinnedAddress` resolves once and validates every answer; `fetchPinned` connects to that IP with the name kept for SNI, certificate and `Host`. Private access only by exact `PrivateDestination` (CIDR ≤ /24 or /120, one port), default none; link-local never |
| Listing | `peer-tools.ts` | Timeout, ≤ 64 tools, ≤ 8 pages, descriptions ≤ 1,024 chars (flagged); SHA-256 **fingerprint** of name, full description, input/output schema, annotations; `detectToolDrift` |
| Identity | `projection.ts` | `peerToolName` — a pure function of (peer, remote name): `mcp_<peer>_<tool>`, or sanitized + cut + 8-hex hash when the name is not provider-safe or exceeds 64 chars. `projectPeerCatalogue` projects all peers at once: duplicate peer ids refused, any case-folded collision **withheld on every side** (`name_collision`), a `TOOL_MANIFEST` name withheld (`name_reserved`); order-independent |
| Risk | `projection.ts` | Default **`write`** (approval-gated). `read` only if the operator lists the tool in `readOnlyTools` **and** pinned its fingerprint. `destructiveHint` raises to `destructive`; no annotation ever lowers risk. A changed or new tool is withheld (`changed_since_approval`, `not_yet_approved`) |
| Disclosure | `disclosure.ts` | `preparePeerArguments` before every send, read or write (below) |
| Calls | `peer-call.ts` | Timeout + abort, result ≤ 16,000 chars (flagged), `structuredContent` validated against `outputSchema` with the SDK's own validator (invalid → text, flagged), the peer's secret scrubbed from results (`credential_redacted`), wrapped by `wrapUntrusted`; 4 calls per turn (`createPeerCallBudget`) |
| Approval | `call-approval.ts` | `PeerCallApproval` binds one call; `verifyApprovedPeerCall` re-checks every binding at execution (below) |
| Execution | `approved-execution.ts` | `executeApprovedPeerCall` — once, verified, no retry, a `PeerCallReceipt` (below) |
| AI SDK tools | `peer-tool-set.ts` | Read tools execute (through the disclosure check); write-risk tools check disclosure, then return the approval sentinel the desk write tools use and **never contact the peer** (a tool with no `execute` would be streamed to the browser as a client action, which the client-actions gate forbids for writes) |

Why the fingerprint pin on read-only tools: a read tool still sends the model's arguments out
of the deployment. "Runs without approval" should apply to one reviewed version of a tool,
not to a name the peer can redefine. This is a standing approval, recorded per tool.

## Disclosure is not risk

Risk asks "can this call change something?"; disclosure asks "what leaves the deployment?". An
operator's read-only tool runs unattended, but it still sends its arguments to a third party
under the deployment's credential. So every call — read or write — passes
`preparePeerArguments`, and nothing is sent unless it says `ok`:

- **Only this call's model-supplied arguments.** There is no parameter through which the
  conversation, a document, desk content, the session or a user token could be added; the
  context is the literal `sends: 'tool_arguments_only'`.
- Plain JSON, canonicalized (the canonical text is what is sized, hashed and sent).
- Valid against the tool's `inputSchema` (the SDK's validator; a schema it cannot compile is
  `schema_unverifiable`, refused).
- At most `maxArgumentBytes` (default 4 KB, ceiling 32 KB, per peer).
- Only the operator's `argumentFields` for the tool, when set — refused, never stripped; `[]`
  sends nothing.
- Never the peer's own resolved secret (`credential_in_arguments`).

The result carries a `PeerCallDisclosure` — `destination` origin, `sends`, `argumentFields`,
`argumentBytes`, `credential` (`none` or `deployment_bearer` + the secret *reference*) — the
data an approval card shows, and the receipt keeps.

## Approval binding

`createPeerCallApproval` records: user id, peer id, endpoint (`href`), remote name, projected
name, contract fingerprint, `permissionDigest` (sha-256 of the operator policy that applies to
this tool: URL, auth reference, allowed/read-only, its rule, the disclosure bound, the private
destinations), the canonical arguments and their sha-256, the disclosure, risk, reversibility,
and an expiry (15 min). Arguments that would fail disclosure are refused at creation, so a call
that can never run is never put in front of a human.

`verifyApprovedPeerCall` runs at the execution boundary and refuses with the first broken
binding: `user_mismatch`, `expired`, `arguments_tampered`, `arguments_mismatch`,
`peer_mismatch`, `endpoint_changed`, `tool_revoked`, `permission_changed`, `peer_unreachable`,
`tool_removed`, `contract_drift`, `tool_withheld`, `disclosure_refused`. It re-lists the tool
(fresh `tools/list`) and re-fingerprints it.

**A fingerprint proves the advertised contract, not behaviour.** It shows the name,
description, schemas and annotations are the ones the user approved; it cannot show what the
peer's code does with the arguments, or that the peer does not change between the check and
the call a few milliseconds later.

## Execution receipts

`executeApprovedPeerCall(approval, deps)`: owner check (a stranger's attempt is refused and
**not** recorded, so it cannot burn the owner's approval) → claim the receipt store by approval
id (a second execute returns the first receipt; a claim without a receipt answers `unknown`,
never a second call) → verify → one `tools/call` with timeout and `AbortSignal` → receipt.
There is no retry anywhere on this path.

| `outcome` | Meaning | `delivery` |
|---|---|---|
| `succeeded` | The peer answered and reported success — a **claim**, not an observed effect | `sent` |
| `failed` | The peer reported an error, or provably nothing was sent (socket never connected, guard refused pre-send) | `sent` / `not_sent` |
| `unknown` | The request may have reached the peer and no reliable answer came back: timeout, reset after send, abort in flight, response over the cap, concurrent claim | `possibly_sent` / `sent` |
| `refused` | A pre-execution check failed | `not_sent` |

`reversibility` comes from the operator (`PeerToolRule.reversibility`: `reversible` ·
`compensatable` · `irreversible` · `unknown`), default `unknown` — never assumed. The peer's
answer stays wrapped as untrusted content in `receipt.result`. `PeerCallReceiptStore` is the
contract (atomic `claim`, `record`); `createInMemoryPeerCallReceiptStore` serves tests and the
interop run. In the product the durable record is `ai.agent_external_operation`: its claim,
dispatch marker and lease healing sit in front of `executeApprovedPeerCall`, which then runs
with a pass-through store ([external-operations.md](./external-operations.md)).

## DNS rebinding: pinned at connect

Outcome: **closed for the MCP client** on the runtimes v10r runs. Every guarded request resolves
the host once, requires every answer to be public (or an exact listed private destination on
that port), and opens the socket to that address with `node:http`/`node:https` (`agent: false`,
no pooled socket), keeping the host name as TLS `servername` (SNI and certificate check) and as
`Host`. Probed on Node 22 (the Vercel `nodejs22.x` runtime) and Bun 1.4.4: both send the SNI,
verify the certificate against it (`ERR_TLS_CERT_ALTNAME_INVALID` on a mismatch), honour
`signal`, and stream SSE bodies. Tests: a resolver answering public first and private after
opens exactly one socket, to the public address, per request, and refuses the next request
before any socket (`endpoint-guard.test.ts`); a TLS peer reached by name through a pinned
loopback address (`pinned-fetch.test.ts`); and at execution, a name that flips to a private
address right after the verification's re-list yields `failed`/`not_sent` with no call reaching
the peer (`approved-execution.test.ts`). No new dependency.

The A2A client now uses the same mechanism: header hygiene, the pinned connect, redirect
refusal and the byte cap live once in `server/http/peer-egress.ts` (`createPeerEgressFetch`),
and `createMcpPeerFetch` keeps only the MCP policy on top (peer origin, bearer by
`MCP_PEER_SECRET_*`, `PeerEndpointError`). The pinned connect ignores `HTTPS_PROXY`; the
deployment restriction is stated in [agent-to-agent.md](./agent-to-agent.md#secured-transport-shared-with-the-mcp-client).

## When to use / when not

Use when a surface should call tools another party runs and you can name the peer and review
its tools. Do not use it for tools you own (add them to the catalogue), or for a peer you
cannot pin (everything stays approval-gated, which may be the honest answer).

## Validation

- `mcp-client.gate.test.ts`: no external tool below `write` unless operator-listed and
  pinned; annotations cannot lower risk; every projected tool is `reach: external` +
  `resultOrigin: user`; external reach implies approval; a gated tool never touches the client.
- `projection.test.ts`: every collision class — two peers, separator overlap, duplicate ids,
  `.`/`-`/`_` normalization, a forged hashed name, case, truncation, reserved names, order.
- `disclosure.test.ts`, `peer.test.ts` (secret namespace incl. `DATABASE_URL`,
  `BETTER_AUTH_SECRET`), `egress-address.test.ts`, `pinned-fetch.test.ts`.
- `approved-execution.test.ts` against an in-process official-SDK peer: once / idempotent /
  concurrent, each refusal reason, timeout / reset / cancel → `unknown` with exactly one call
  on the wire, rebinding at execution, and a scan of results, receipts, approvals and errors for
  the bearer secret (a hostile peer echoing it is scrubbed).
- `peer-interop.test.ts` against in-process official-SDK servers, benign and **adversarial**.
- `bun run mcp:client:interop` (**20/20**, `scripts/mcp-client/interop-report.json`): a
  Python server on the official Python SDK (`mcp==2.3.0`) — era negotiation, listing,
  unpinned/pinned projection, misleading `readOnlyHint` not obeyed, wrapped text, validated
  structured output, write tool only proposes, disclosure refusal, approved execution once,
  argument and endpoint binding, guard refusals (scheme, secret namespace, private address) —
  plus v10r's own public server and a cross-peer catalogue check. Runs under Bun, through the
  pinned fetch.

## Limitations

- OAuth (CIMD) is not implemented; only `none` and a deployment bearer. No user-delegated
  credential exists, so a peer always sees the deployment, never the user.
- A connection per request (no keep-alive) — the price of pinning without a pooled agent.
  An `HTTPS_PROXY` is not used by the pinned fetch (a proxy would resolve the name again).
- The fingerprint check and the call are two requests: a peer can still change between them,
  and a fingerprint never proves behaviour.
- `verifyApprovedPeerCall` spends the approval on any refusal, including a transient
  `peer_unreachable` — re-approve.
- `succeeded` is the peer's claim; nothing observes the remote effect.
- `@modelcontextprotocol/client` is still a devDependency, although the deskbot now imports
  it at runtime: moving it to `dependencies` re-hoists zod and changes the stdio bundle's
  inputs, so the move needs `mcp:bundle:build` and a production build, which this change did
  not run.

## Wired into the deskbot

Built 2026-11-24 ([external-operations.md](./external-operations.md)):

- **Peer directory.** `peer-directory.ts` over `ai.mcp_peer` / `ai.mcp_peer_tool`, managed
  at `/admin/ai/peers`. Every activated tool is listed under its pin, with `readOnlyTools`
  always empty.
- **Operation adapter.** `createMcpOperationAdapter` in `operation-adapter.ts` re-checks
  revocation, permission, endpoint and contract at verify and again before the send.
- **Capability.** `external-tools` mounts the peer tools as gated tools.
- **Card.** `ExternalOperationCard` shows the disclosure.
- **Approval.** The approve route runs the persistent claim.
