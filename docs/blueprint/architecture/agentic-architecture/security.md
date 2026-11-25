# Agentic security — one trust model across every door

Every interop door (MCP server and client, A2A server and client, AG-UI, WebMCP, generative
surfaces, Agent Skills) is held to the rules the in-app assistant already follows. This page
lists them once.

## Operation classes

An operation is classified by what it does; the class decides the gate. The door it arrives
through decides nothing.

| Class | Example | Gate |
|---|---|---|
| Presentation | Render a generative surface, stream text | None — data, not code; catalog allowlist |
| Local interaction | Type into a surface field, toggle a checkbox | None — local data model, no round trip |
| Read | Search patterns, list files, review an architecture model | Auth/ownership as the caller; bounded results |
| View change | Open or focus a panel (client action, WebMCP) | `view` risk: auto, budgeted, read back |
| Persistent creation | Create a desk file | `create`: auto with notification (unchanged) |
| Persistent modification | Edit a file | `write`: proposal → human approval → replay with receipts |
| Destructive | Delete | `destructive`: explicit confirm |
| External communication | Call an external MCP tool | `reach: external` → approval-gated (untrusted-content gate) |
| Remote delegation | Send a task to an A2A peer | Operator-listed peer and skill; `reach: external` → disclosed, human-approved external operation, once; budget one per turn, depth one; result is a *claim* |
| Remote execution | Run code a model produced | **Never** — rejected in every form |

## Requested, executed, confirmed — and claimed

v10r already separates *requested* (the call left), *executed* (a handler ran) and *confirmed*
(the state was observed afterwards). Remote agents add a fourth word: **claimed** — a peer
says it did something. A2A artifacts, MCP tool results and WebMCP callers' reports are
claims: validated against a schema, bounded, wrapped as untrusted content, never used as an
authorization input and never shown as verified. An A2A delegation receipt keeps the five
apart: approved (requested), sent (executed, with `delivery`), `succeeded` (the peer
*claims* a completed review), a cancel the peer confirmed (still its claim), and never
*verified*.

## Threats and where each is held

| Threat | Held by |
|---|---|
| Prompt injection via external content | `resultOrigin: 'user'` → `<untrusted-content>` for every external result (MCP client, A2A client) |
| Forged tool results in the history a client sends | Chat and desk turns: every server tool result in the request is replaced by the copy the conversation's rows hold; one the rows do not hold reaches the model wrapped as untrusted content whatever the tool's declared origin (`ai/recorded-tool-results.ts`); client action results go through their own contract door (`client-action-results.ts`); the AG-UI endpoint admits a replayed server result only under its ticket. None of these results ever authorized anything: approvals are proposal rows |
| Tool poisoning (lying descriptions/annotations) | Annotations never lower risk (AA2); descriptions prefixed as external; drift fingerprint forces re-approval |
| Malformed interface definitions | A2UI catalog validation (unknown components/props, depth, size, binding paths, URL schemes) before render; renderer never uses `{@html}` |
| Unauthorized state change | Only server tools change data, only after approval; surface actions, WebMCP and AG-UI frontend tools are view-risk. The AG-UI endpoint takes only declared client actions from `RunAgentInput.tools`, admits a replayed server tool result only under the ticket it issued (`ai/ag-ui/tool-result-ticket.ts`), and refuses `state` and `resume`, so a client cannot fabricate a tool result or an approval |
| Cross-tenant leakage | Domain functions are owner-scoped; A2A server skill is stateless and holds no user data |
| Credential exposure / token passthrough | MCP and A2A clients never forward a session or user token: the shared peer egress drops `cookie`, `authorization` and `proxy-authorization` and sends only the peer's own bearer, by secret reference (`MCP_PEER_SECRET_*`, `A2A_PEER_SECRET_*`) |
| Delegated permissions | A peer gets nothing v10r did not decide to send; no OAuth delegation is built |
| Data exfiltration through tool arguments | The content screen before every proposal: secrets (deployment values, credential shapes) and relayed `<untrusted-content>` refused; arguments that quote what the turn read (`quotes_read_content`) run only with a separate quoted-content authorization on the card; the complete outgoing arguments shown on the card under the approval's argument digest (64 KiB bound); the operator's field allowlist and byte cap; every external call, read or write, approval-gated. The screen is defense-in-depth, not DLP: a paraphrase is not caught |
| Unreviewed peers or tools | Peers and tools exist only in the operator's directory (`/admin/ai/peers`); a tool runs only at the fingerprint the operator activated; revocation and drift are re-checked at verify and before the send |
| Replay / duplicate execution | Client-action runner dedups by call id; WebMCP calls are budgeted (no shared call id); proposals replay once; an approved MCP peer call or A2A delegation runs once per approval: in the product the claim is a row in `ai.agent_external_operation` (one transaction with the proposal, one winner across instances, a dispatch marker before the send, a stale claim healed to `failed`/`not_sent` or `unknown`/`possibly_sent`, never re-run), and an unknown outcome is never retried ([external-operations.md](../../ai/external-operations.md)); an A2A delegation binds the agent card digest, the operator policy and the arguments digest, so a changed card, policy or model refuses; a surface action naming a superseded render is `stale_surface` |
| SSRF | Peer allowlist; https only; private, link-local, loopback and metadata addresses refused; redirects are errors. MCP and A2A clients share one secured transport (`http/peer-egress.ts`): DNS answered once, every address checked, the socket pinned to the checked address with SNI, certificate check and `Host` kept for the name (`http/pinned-fetch.ts`), so a rebinding answer cannot redirect the call; private destinations only as an exact range plus port (`PrivateDestination`), link-local never. The pinned connect bypasses `HTTPS_PROXY`: a proxy-only deployment cannot reach peers ([agent-to-agent.md](../../ai/agent-to-agent.md#secured-transport-shared-with-the-mcp-client)) |
| Sandbox escape | No third-party HTML is hosted (MCP Apps host deferred) |
| Resource exhaustion | Body caps, result caps, tool-count caps, per-turn and per-minute budgets, timeouts with abort; A2A: 512 KiB per response, 64 stream events, one delegation per turn and three per conversation, `CancelTask` after a timeout or abort |
| Excessive token consumption | Express format; catalog pruning; bounded tool lists from peers |
| Recursive delegation | v10r's A2A skills run deterministic checks, no assistant, so an inbound task cannot reach `delegate_architecture_review`; the delegation budget refuses any proposal from a turn at depth ≥ 1 and more than one per turn; outgoing messages carry `v10r.delegationDepth: 1` |

## What is not claimed

No penetration test was run. The adversarial suites are unit and in-process interop tests
with hostile fixtures; the Python peers are local processes, not hostile networks.
