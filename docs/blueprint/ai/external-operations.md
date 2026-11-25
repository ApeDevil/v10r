# External operations

An **external operation** is an assistant action that leaves the deployment: an MCP peer tool
call (`protocol: 'mcp'`) or an A2A delegation (`protocol: 'a2a'`). This page covers the one
path every external operation takes, from the model's call to the receipt. The MCP specifics
(guard, fingerprints, projection) are in [mcp-client.md](./mcp-client.md). The A2A agent is in
[agent-to-agent.md](./agent-to-agent.md).

Status (2026-11-24): **built and wired to the deskbot** for MCP. A2A has a registration point,
but no adapter is wired to it yet.

## Problem

The model calls a tool another party operates. Three things can go wrong:

- the model sends what it should not,
- the call runs twice,
- a lost answer is reported as a failure, and somebody retries a mutation that already
  happened.

The in-memory receipt store that the MCP client shipped with cannot survive a restart, and
it cannot see a second instance. It therefore does not hold any of these lines in
production.

## Decision

One framework-free domain, `#lib/server/external-operations/`, owns everything that is common
to every protocol:

- the disclosure rule,
- the binding the approval covers,
- the persistent execution claim,
- the receipt,
- the rule that a possibly-sent operation is never retried.

Each protocol plugs in through one `ExternalOperationAdapter` (`prepare` · `verify` ·
`execute`). The domain imports no protocol: adapters are passed in as
`ExternalOperationAdapters`, a map keyed by protocol. `externalOperationAdapters(actor)` in
`server/ai/proposals/external-approval.ts` is the registration point, and today it holds only
`mcp`.

```
model calls mcp_<peer>_<tool>
  → prepareExternalOperation: content screen → adapter.prepare → binding check
  → approval sentinel; the proposal and its agent_external_operation row are written in ONE transaction
  → the card shows the disclosure; the user approves once (and separately authorizes quoted content)
  → POST /api/ai/proposals/:id/approve → executor.approve
      owner check → heal a stale claim → settled? answer it → quoted-content check
      → approveProposal → CLAIM (one transaction) → arguments digest → adapter.verify
      → DISPATCH MARKER → adapter.execute (once) → settle + receipt message
```

## Persistence: `ai.agent_external_operation`

There is one row per proposal (`proposal_id` is the primary key and cascades from
`agent_proposal`).

The row stores the binding:

- the user, the protocol and the peer,
- the operation, the tool name and the endpoint,
- the contract, policy and arguments digests,
- the arguments and the full disclosure.

It also stores the lifecycle (`status`, `delivery`, `reason`, `result`, `claim_token`,
`claimed_at`, `dispatched_at`, `settled_at`) and the approval's `expires_at`. Every transition
is one conditional statement, or one transaction, in `#lib/server/db/ai/external-operations.ts`:

| Transition | Predicate (the rule) |
|---|---|
| `pending → claimed` (with proposal `approved → executing`) | Both unexpired by the database clock; the owner's row; one transaction, so the loser of a race gets null |
| `claimed → dispatched` | Written immediately **before** the request may leave. Requires the claim token; a healed claim cannot send |
| `claimed / dispatched → succeeded · failed · unknown · refused` | Only the claim's owner; a late answer cannot overwrite a healed row |
| `pending → refused` | The proposal was rejected or expired; nothing was sent |
| heal after the lease (`EXECUTION_LEASE_MS`, 2 min — the proposal executor's) | A stale `claimed` row becomes `failed` / `not_sent`; a stale `dispatched` row becomes `unknown` / `possibly_sent`; the proposal becomes `failed('interrupted')` |

No statement moves a row back to `pending`. An approval is therefore executed at most once,
however many instances race it, and an interrupted call is never re-run. **There is no retry
anywhere on this path**: `unknown` is a terminal answer that the user reads.

The heal runs in two places: on the next approve attempt, and on every read of the proposal
status route (`GET /api/ai/proposals/:id`) for a proposal that has an external row. An external
proposal is healed **by its own row only**: the desk plans' proposal-level lease
(`markInterruptedIfStale`, measured from the claim) is skipped for it, because the row's lease
runs from the dispatch and the proposal would otherwise read `failed` while its call is still
inside its own window. The read also refuses a `pending` row whose approval can no longer run
(the proposal expired on the database clock, or was rejected), so the row and its proposal never
disagree about whether it may still run.

### At most once, not exactly once

The guarantee is **at most once**: a call is sent zero or one times per approval. It is not
exactly once, and nothing here pretends otherwise. A request that left and whose answer was
lost ends `unknown` / `possibly_sent`; the peer may or may not have acted, v10r cannot tell,
and it never re-sends to find out. Exactly-once would need the peer's cooperation (an
idempotency key it honors, or a remote task v10r can query), which neither MCP tool calls nor
the A2A delegation give it. There is no durable workflow engine on purpose: a row, a claim
token and the database clock are the whole mechanism.

### The serverless execution model

On Vercel the approve route runs in one function invocation with `maxDuration: 60`
(`api/ai/proposals/[id]/approve/+server.ts`). The adapters' own budgets are inside that: MCP
connect and list 10 s each and the call 20 s (`mcp-client/config.ts`), the A2A delegation
10 s overall (`a2a/config.ts`). The lease is 120 s, twice the function's ceiling, so a claim the
heal settles belongs to an invocation the platform has already ended: the heal never races a
live executor on Vercel. If it ever did (a longer-running host), the claim token still holds:
a healed `claimed` row refuses the late dispatch marker (nothing is sent), and a healed
`dispatched` row refuses the late settlement (the row stays `unknown`, the conservative
answer). Nothing runs in the background after the response (`waitUntil` is not used), so a
response that reached the client means the row was settled first. Recovery is lazy, on the
next read; no cron is needed, because an unsettled row blocks nothing but its own card.

### The receipt message

The receipt message is the deterministic text of the row (`externalReceiptText`), so a missing
one is rebuilt from the row without running anything. Its id is derived from the operation
(`externalReceiptMessageId`, a sha-256 of the proposal id in UUID form) and the insert claims
that id (`saveMessages` with `claim`), so the executor that settled the row, a racing approver
and a later reader all name the same message and the thread holds it once. It is written when
the executor settles the row, and restored by any later approve answer or status read when it
is missing: after a heal (which settles without one), after a crash between the settlement and
the insert, or after a failed insert. A row refused before any claim (expired, rejected) gets no
receipt line: nothing was approved to run. The client keys receipts by id, so an answer that
repeats the message adds nothing to the thread.

## Disclosure authorization

The approval covers the binding, and it also covers **what leaves**. Before anything is
proposed, `screenExternalArguments` (`content-screen.ts`) reads every string in the arguments
and acts on what it finds:

- **A secret is refused outright** (`secret_in_arguments`). That covers two cases. One is a
  deployment secret value of 12 characters or more, read from secret-shaped environment names
  (`deploymentSecretValues`). The other is a credential shape: a PEM key, `sk-…`, `ghp_…`,
  `xox…`, `AKIA…`, a JWT, or a URL with a password in it. No approval can send one.
- **Relayed untrusted markup is refused** (`untrusted_markup_in_arguments`). An
  `<untrusted-content` wrapper in the arguments means the model is passing one third party's
  answer to another.
- **Quoting what the turn read is its own class** (`ExternalContentClass`). The screen looks
  at what this turn put in front of the model: tool results, and open Desk panels. If a
  24-character window of that text (`QUOTE_WINDOW_CHARS`) appears in the arguments after
  whitespace and case normalization, the class is `quotes_read_content`, and `quotedFrom`
  names the sources. Otherwise the class is `arguments_only`.

`quotes_read_content` runs only with a **separate, explicit quoted-content authorization**.
The card shows a checkbox, and the approve body carries `authorizeQuotedContent: true`.
Without it, approval is refused (`quoted_content_unauthorized`) before anything is claimed,
so the approval is not spent. An operator's field allowlist says **which** fields may leave.
It never says that confidential content may travel in them.

The domain, not the adapter, sets `contentClass` and `quotedFrom`. An adapter returns an
`ExternalDisclosureDraft`, and the domain completes it.

## The card and the surface

The card is on the **deskbot**. The deskbot is the authenticated surface. It already has
persisted conversations, the proposal / approve / receipt path and `PlanCard`. The chatbot's
identity is read-only, and it serves anonymous visitors.

- The `external-tools` capability (`server/ai/capabilities/external-tools.ts`) activates for a
  signed-in user on a tool turn. It mounts every live peer whose audience admits the user's
  role and that has at least one activated tool. It lists each peer afresh and projects the
  tools under the operator's pins, so a tool that drifted is withheld.
- Each mounted tool's `execute` **never contacts the peer's tool**. It prepares the operation,
  keeps it on the turn by tool call id, and returns the approval sentinel. The orchestrator
  persists the proposal together with its external row. An external operation must be the
  only approval request in its step (`EXTERNAL_PROPOSAL_ALONE`).
- Reads are not exempt. An external read discloses its arguments just as a write does, so the
  directory never lists a peer tool read-only, and every peer tool call is approval-gated.
- `ExternalOperationCard.svelte`, inside `PlanCard`, shows, each as its own row: the peer, the
  destination origin, the operation, the fields and exact size, the credential identity (none,
  or the operator's secret **reference**), whether it mutates, its reversibility, and that the
  authorization is for this one call. Below the rows:
  - the **compact preview** (`previewExternalArguments`): canonical JSON, each string cut at
    80 characters and the whole at 600, readable at a glance;
  - the **complete outgoing arguments**, a separate expandable section (see below);
  - the content class and its sources, with the quoted-content checkbox;
  - after the run, the outcome and delivery, with the peer's answer marked as an untrusted
    claim.

  It offers no undo. The receipt is also saved as an assistant message in the conversation.

### Complete outgoing arguments

The preview shortens values, so it cannot be what a user inspects before sending a long field.
`outgoing-arguments.ts` gives the card the whole value (`ExternalOperationCard.outgoing`):

- `document`: the arguments pretty-printed in canonical key order. Characters a reader cannot
  see (DEL and C1 controls, zero-width, bidi marks and overrides, BOM) are written as `\uXXXX`
  escapes, so a value cannot hide or reorder text on screen. The escapes are JSON for the same
  characters, so the value does not change.
- `digest`: the binding's `argumentsDigest`. Parsing `document` back gives a value whose
  canonical JSON hashes to it, and execution refuses stored arguments that no longer match it
  (`arguments_tampered`). The inspection and the authorization therefore name one payload.
- `envelope`: what the protocol adds beside the arguments and the digest does not cover
  because the adapter, not the model, sets it. For A2A that is `metadata.skill` and
  `metadata.v10r.delegationDepth`; MCP adds nothing beyond the tool name, which is the
  operation row.

The arguments already passed the content screen, so no secret reaches the card: one would
have refused the proposal. Size is bounded where it is decided: `prepareExternalOperation`
refuses arguments over `MAX_EXTERNAL_ARGUMENT_BYTES` (64 KiB of canonical JSON,
`arguments_too_large`), so every card carries its document whole and nothing that is sent is
left out of the inspection. MCP peers are capped lower by their own byte cap (32 KiB at most),
so the bound binds only an A2A architecture model too large to read on a card. The document
scrolls inside the card (`max-height`), and the card is rebuilt from the stored row on reload
with the same bytes and digest.

## Peer administration

The admin page is `/admin/ai/peers`. Peers live in `ai.mcp_peer`, and their discovered tools
live in `ai.mcp_peer_tool`. On that page the operator:

1. saves a peer: an https URL, a credential **reference** (`MCP_PEER_SECRET_*`, never a
   value), an audience (`admin` · `user`), an argument byte cap and private destinations;
2. tests it, then discovers its tools (the fingerprints are recorded, and drift against the
   pins is reported);
3. activates a tool at the fingerprint they reviewed. The update is conditional, so a
   fingerprint the peer no longer lists is refused. With the activation they record
   `mutates`, `reversibility` and the argument field allowlist;
4. deactivates a tool or revokes the peer at any time. Revocation is re-checked when the
   operation is verified and again just before it is sent.

Users never configure an endpoint.

## Validation

- `external-operations/execution.pglite.test.ts` checks these cases:
  - two executors racing the same approval (one wire call);
  - a crash after dispatch, which ends `unknown` / `possibly_sent` and is never re-run;
  - a crash before dispatch, which ends `failed` / `not_sent`;
  - `unknown` is not retried;
  - owner, expiry, verify refusal, tampered arguments, quoted content, secret refusal;
  - a lost receipt message rebuilt from the row by a reader, once, with no second call; a
    healed row's receipt written by the next answer; a pending row whose proposal expired
    refused by a reader, with no receipt line;
  - the card's complete outgoing arguments are the value the approval binds and executes,
    the same after a reload, and arguments over the size bound are never proposed.
- `external-operations/content-screen.test.ts` covers the content screen, case by case;
  `outgoing-arguments.test.ts` the complete document (whole values, key order, escaped
  invisible characters, digest round trip).
- `components/composites/chatbot/external-operation-card.render.test.ts` renders the card:
  separate rows, preview and complete view apart, the A2A envelope, markup escaped.
- `ai/mcp-client/python-peer.pglite.test.ts` is the **Python peer demo**. It runs the real
  `scripts/mcp-client/peer/server.py` over HTTP, puts the peer in the directory, discovers
  and activates `note_read` / `note_write`, and goes through the real approve route. It
  checks:
  - mounting;
  - an approved mutation and an approved read, each ending in a receipt message;
  - a stranger's 404;
  - an argument field outside the allowlist, which is never proposed;
  - a revoked activation (`tool_revoked`);
  - contract drift (`contract_drift`, after which the tool is no longer mounted).

## Limitations

- OAuth is out of scope. Peers authenticate with a deployment bearer through a secret
  reference, so a peer sees the deployment, never the user.
- The admin page stores https endpoints only. The Python demo seeds a loopback peer row
  through the database function, and allows loopback HTTP in its test connection only.
- **The content screen and the copied-content detection are defense-in-depth, not data loss
  prevention.** They refuse the obvious (known secret values, credential shapes, relayed
  `<untrusted-content>`) and flag literal quotes of what the turn read. They do not classify
  data, do not know what is confidential, and a paraphrase, a translation, an encoding or a
  fragment shorter than 24 characters is not a quote. What protects the data is the human
  reading the complete outgoing arguments before approving, the operator's field allowlist
  and byte cap, and the approval gate on every external call, read or write.
- `succeeded` is the peer's claim; nothing observes the remote effect.
- A2A delegation (`a2a/external-adapter.ts`) is registered beside MCP in
  `ai/proposals/external-approval.ts`; it is read-only on the peer (`mutates: false`) and
  bounded per turn and per conversation (`a2a/delegation-budget.ts`).
