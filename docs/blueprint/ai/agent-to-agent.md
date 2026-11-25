# Agent to agent — A2A specialist agents

**Maturity: built** (server, client, assistant-driven delegation and a cross-language interop
run on branch work; delegation is wired to the deskbot through the external-operations
approval door — see Wiring; no live model turn has delegated yet; the official A2A TCK was not
run — see Validation).

## Problem

Some evaluations belong to agents another team, framework or language owns — a security
reviewer, a performance specialist, an infrastructure agent — deployed and versioned on their
own. v10r should be able to ask them, and to *be* one for others, without either side
adopting the other's runtime.

## When A2A, and when something simpler

| Situation | Use |
|---|---|
| A specialist inside the same app and runtime | A capability / sub-agent in the one orchestrator |
| A model that needs a tool | A tool (`TOOL_MANIFEST`), or MCP for someone else's tools |
| Two services you own, fixed contract | Direct service API (`external-service.md`) |
| An **independently operated agent** with its own lifecycle, long tasks, its own model and framework | **A2A** |

## Decision

- **Server.** `/.well-known/agent-card.json` and `POST /api/a2a` (JSON-RPC 1.0 binding, SSE
  streaming) over the official `@a2a-js/sdk` 1.3.0 — no Express: `http.adapter.ts` maps a web
  `Request` to the SDK's `JsonRpcTransportHandler`. Two skills: `architecture-security-review`
  and `architecture-review`, which run Architecture Studio's deterministic checks
  (`checkSecurity`, `checkArchitecture`) on a submitted model. **No model call, no quota, no
  user data.**
- **Per-request task store.** A fresh `DefaultRequestHandler` + `InMemoryTaskStore` per
  request: a shared store let `ListTasks` return other callers' tasks on a warm instance.
  Every task completes inside `execute`; earlier task ids answer `TaskNotFound`. Durable
  tasks would need a database `TaskStore` (not built; see AA11).
- **Bounded input.** Body ≤ model file limit + 64 KiB (413), ≤ 4 parts, text parts ≤ 2,000
  chars, exactly one data part (the model), `parseArchitectureModel` must pass; otherwise a
  `TASK_STATE_REJECTED` task with up to 50 issues. Public, unauthenticated, read-only, 30
  requests/min per /64 IP bucket, CSRF-exempt like the public MCP route.
- **Client.** `delegateArchitectureReview(peer, model, opts)`: exact-origin allowlist
  (`peer-policy.ts`); https, plain http only to a loopback IP literal when the caller passes
  `allowLoopbackHttp` (tests, interop); non-public addresses refused unless the peer lists an
  exact `PrivateDestination` (narrow CIDR + port; link-local never); one deadline; 512 KiB per
  response; JSON-RPC transport only, on the guarded fetch (the SDK's default factory would
  add a REST transport on the global fetch).
- **Secured transport, shared with MCP.** Every request goes through
  `server/http/peer-egress.ts` (`createPeerEgressFetch`) — see the next section.
- **Streaming and cancellation.** When the card offers streaming, the send is
  `SendStreamingMessage`: the first event names the remote task, so a timeout or abort after
  that point sends `CancelTask` on its own 3 s budget and records `cancellation`
  (`confirmed` · `not_confirmed` · `no_task`). A blocking peer returns no task id before its
  answer and cannot be cancelled. ≤ 64 stream events.
- **Claims, not evidence.** Every outcome is `claimed` · `declined` · `refused` and carries
  the literal `verified: false`, the remote `correlation` (task id, context id) and, for a
  refusal, `delivery` (`not_sent` · `sent` · `possibly_sent`). Findings are rebuilt from known
  fields; malformed entries are dropped and counted; a wrong envelope or > 200 findings
  refuses the whole report. The outgoing message carries `v10r.delegationDepth: 1`.

## Secured transport (shared with the MCP client)

One module holds the outbound responsibilities both protocols have, in this order per
request; each protocol keeps only its own policy and its own error vocabulary (`refuse`):

| Step | Held by `peer-egress.ts` | Protocol policy on top |
|---|---|---|
| Admission | asks `admit(url)` first; nothing is resolved before it | MCP: the peer's own origin only (`foreign_origin`). A2A: the allowlist, IP-literal check, scheme |
| Credential isolation | drops `cookie`, `authorization`, `proxy-authorization`; sends only `authorization()` | MCP: bearer by `MCP_PEER_SECRET_*`. A2A: bearer by `A2A_PEER_SECRET_*`, or none |
| Pinned connect | resolve once, every answer public or a listed `PrivateDestination`, socket to that address with SNI, certificate check and `Host` for the name (`pinned-fetch.ts`) | the `PrivateDestination`s the peer config lists |
| Redirects | a 3xx is a refusal | — |
| Size | declared `content-length` over the cap refused unread; the stream errors past the cap (SSE still streams) | MCP 4 MiB, A2A 512 KiB |
| Cancellation, timeouts | the egress signal merges with each request's own and reaches the socket | MCP: per-call timeout. A2A: one delegation deadline, separate cancel budget |

**Proxy restriction.** The pinned connect opens its own socket (`agent: false`) and ignores
`HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY`: a forward proxy resolves the name again, which is
the second lookup pinning removes. A deployment whose only route out is an egress proxy
cannot reach MCP or A2A peers; the server functions need direct outbound TLS to each peer
address (Vercel functions have it). A proxy-only network needs a CONNECT-to-IP proxy and a
change in `peer-egress.ts`, not a setting. The interop harness's own probes (plain SDK
clients) still use the global fetch; product code never does.

## Assistant-driven delegation

`delegate_architecture_review` (manifest: chatbot, `risk: 'write'`, `reach: 'external'`,
`resultOrigin: 'user'`; capability `agent-delegation`) asks an operator-configured peer to
review an architecture model, through the external-operations contract
(`server/external-operations/contract.ts`):

1. **Peer authorization.** Only an `A2aDelegationPeer` the operator listed exists (id, label,
   origin, the A2A skills v10r may ask for, credential by secret reference, private
   destinations, reversibility). The model names a peer id, never an endpoint. A skill must be
   allowed by the operator *and* offered by the peer's card — the card can narrow, never widen.
2. **Budget and depth** (`createDelegationBudget`): one per turn, three per conversation,
   depth one — a turn that runs for a delegated task (none exists today) may not delegate.
   Spent before any network or human is involved.
3. **`prepare`** (adapter, `a2a/external-adapter.ts`): agent discovery — the card is read
   through the secured transport, no task sent — then the **disclosure** (destination origin,
   skill, the fields sent, a preview of the model, its size, the credential reference, `mutates:
   false`, the operator's reversibility, `grant: 'once'`) and the **binding** (card digest over
   name, version, interfaces, streaming and the chosen skill; operator policy digest;
   arguments digest; user; 10-minute expiry). The tool hands both to `propose` (the
   external-operations door) and answers the approval sentinel with the disclosure.
4. **`verify`** after approval: not expired, peer still listed with the same policy, card
   still digests the same.
5. **`execute`** once per approval, never retried: arguments must digest as approved; the
   delegation runs with the card digest bound, so a card swapped after `verify` refuses
   (`card_changed`) before the send. Outcome mapping: claim → `succeeded`/`sent`; declined →
   `failed`/`sent` (`peer_declined`); policy refusal → `refused`/`not_sent`; invalid answer or
   oversize → `failed`/`sent`; timeout or abort → `unknown`, or `failed` when the peer
   confirmed `CancelTask`. The result text is wrapped by the assistant layer's
   `wrapUntrusted`, and `remoteTask` carries the peer's task and context ids.

Requested, executed, claimed, confirmed, verified stay distinct: the receipt says the
operation was *requested* (approved) and *executed* (sent); `succeeded` means the peer
*claims* a completed review; a confirmed cancel is the peer's claim too; nothing a peer says
is ever *verified*.

### Wiring

Delegation is one more external operation, on the same path as an MCP peer tool
([external-operations.md](./external-operations.md)):

1. **Operator config.** `A2A_DELEGATION_PEERS` holds a JSON array of `A2aDelegationPeer`
   (`a2a/delegation-directory.ts`); an entry with a problem (`delegationPeerProblems`) is
   dropped with a warning. Secrets by reference only, `A2A_PEER_SECRET_*`
   (`a2aEnvironmentSecretResolver`). Unset: no peer, the capability stays inactive.
2. **Turn.** For a signed-in deskbot turn of a persisted conversation, the orchestrator builds
   the `DelegationTurnContext` (`delegationTurnContext`): the adapter, the peer choices, and a
   budget whose per-conversation count is read from the conversation's
   `agent_external_operation` rows (`countConversationExternalOperations`), so trimming the
   history a client sends does not reset it. The tool is in the manifest under the deskbot,
   `desk:read`, `risk: 'write'`, `reach: 'external'`.
3. **Propose.** The tool spends the budget, then `prepareExternalOperation` runs the content
   screen over what the turn read and the adapter's `prepare` (card read, no task sent), and
   stashes the prepared operation by tool call id. The orchestrator persists the proposal and
   its operation row in one transaction (`EXTERNAL_PROPOSAL_ALONE`: alone in its step); the
   `ExternalOperationCard` shows the disclosure.
4. **Execute.** The approve door's executor holds the `a2a` adapter
   (`externalOperationAdapters`): claim, `verify` (expiry, policy and card digest), dispatch
   marker, `execute` once, settle. The receipt records the remote task id (id-shaped values
   only; anything else is dropped, because the id is shown outside the untrusted wrapper) in
   the row's `result`, and the receipt message names it — the correlation key into the peer's
   own trace.

Evidence: `ai/proposals/a2a-delegation.pglite.test.ts` runs tool → proposal → two racing
executors against a loopback peer: one SendMessage on the wire, the remote task recorded, a
third executor answers from the row.

## Interoperability evidence

`bun run a2a:interop` (`scripts/a2a/interop-report.json`, byte-stable across runs): **24/24**.

- **JS client → Python server** (`scripts/a2a/peer/performance_agent.py`, Python `a2a-sdk`
  1.3.1 — an independently implemented performance specialist with its own rules): card,
  streamed claim with findings, adversarial reply (1 kept, 4 dropped), unknown skill and
  invalid model rejected, loopback refused without a listed private destination, unknown task
  get/cancel, streaming order.
- **Assistant delegation → Python server** (the adapter's prepare → verify → execute):
  success (wrapped, unverified claim with the remote task id), rejection (`peer_declined`),
  invalid report (`invalid_answer`, no claim), timeout and caller abort mid-task (both with a
  `CancelTask` the Python peer confirms as CANCELED), budget/depth refusal, a skill the card
  offers but the operator did not allow. Fixture skills exist only with `--allow-fixtures`.
- **Python client → v10r server** (the shipped adapter on `Bun.serve`): card at JSONRPC 1.0,
  security review completed, invalid model rejected, unknown task get/cancel, streaming.

## Security

Recursive delegation is bounded twice: v10r's served skills run deterministic checks, no
assistant, so an inbound task can never reach the delegation tool; and the delegation budget
refuses any proposal from a turn at depth ≥ 1. The tool is `reach: 'external'` and therefore
approval-gated (`untrusted-content.gate.test.ts`).

## Validation

`src/lib/server/a2a/*.test.ts` (65) and `src/lib/server/http/peer-egress.test.ts` (13), on real
loopback sockets through the pinned egress: card shape, send/stream, invalid model, oversized
body, unknown method, allowlist, SSRF (169.254.169.254, RFC 1918, unlisted loopback, the
metadata range even when listed), DNS rebinding between the card and the send, TLS name check
on a pinned address, redirect refusal, size cap (declared and streamed), abort, timeout with
and without a task to cancel, cancel confirmed and refused, malformed findings dropped and
counted, card drift, operator policy drift, expiry, tampered arguments, one execution per
approval, claims never verified. `src/lib/server/ai/tools/delegate-review.test.ts` (8): the
tool never executes, budget and depth, inactive without a context. **Not run:** `a2a-tck` (no
PyPI package; the GitHub download was blocked in the session) — run locally:
`git clone https://github.com/a2aproject/a2a-tck && ./run_tck.py --sut-host http://localhost:5173/api/a2a`.

## Limitations

A2A 0.3 peers are refused (`legacyCompat` off; Mastra, ADK-TS and CrewAI still speak 0.3).
Agent Card JWS signatures are not used — the card digest pins what was approved, not who
signed it. No proxy support (see Secured transport). A blocking peer cannot be cancelled.
No live model turn has delegated yet (no provider keys in the cloud; the local procedure
covers it). The turn trace's `ToolExecutionRecord.remoteTask` is filled from the receipt row,
not from a column of its own on `ai.tool_call`.
