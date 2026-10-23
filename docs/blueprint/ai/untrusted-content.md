# Untrusted content

How v10r keeps a document a user ingested from steering the assistant that reads it — the
"lethal trifecta" of prompt injection, and the code that holds each of its three legs.

## Untrusted-content boundary

**Problem.** An assistant that (1) reads content someone else could have written, (2) can
reach private data, and (3) can send something out — a fetch, an email, an image URL in its
answer — can be made to exfiltrate that data by instructions hidden in the content. No
detector reliably spots the instructions; the defence that holds is structural: bound the
content, and take away a leg. The deskbot meets leg 1 on every turn — open panels, file reads
and knowledge search are all user-controlled text, file names included.

**Method.** One rule per leg, each enforced in one place:

| Leg | Rule | Where |
|---|---|---|
| 1. Untrusted input | Every tool declares `resultOrigin` (`system` · `user`). A `user` result reaches the model as one escaped `<untrusted-content source="…">` element — through AI SDK `toModelOutput`, so the loop's own value (approval sentinels, desk effects, the turn trace) stays raw. Results replayed from earlier turns get the same wrapping, failing closed on any shape (a compacted projection, an error, a multi-part output). Prompt blocks (`<desk-context>`, `<retrieval-context>`) were already escaped | `ai/untrusted-content.ts` (`withUntrustedBoundary` in `composeTurn`, `boundHistoryToolResults` in the orchestrator); `TOOL_MANIFEST` in `types/ai-tools.ts` |
| 2. Exfiltration | Every tool declares `reach` (`internal` · `external`). An `external` tool must be approval-gated (`requiresApproval(risk)`). None exists today; because the label is self-declared, the gate also scans the tool modules and fails on a fetch, socket or delivery-channel import while every tool says `internal` | `untrusted-content.gate.test.ts` |
| 3. Output channel | Model output renders with no `<img>` (the automatic beacon) and no link to a host outside `TRUSTED_LINK_HOSTS`; only `http`/`https` | `utils/markdown.ts` (`untrusted: true` is the default) |

The data-not-instructions rule (`profile/shared-rules.ts`) names the tag, so the model is told
what the boundary means. That sentence is guidance; the escaping is the guarantee.

**What is not claimed.** An error the AI SDK raises while running a tool (invalid input) reaches the model as its own `error-text`, outside the boundary; it echoes model-produced input, not stored content. Whether a model obeys text inside the boundary is not testable and
not tested. Injection detectors and classifiers are not used: they are probabilistic, and a
missed detection on a turn with all three legs is the whole incident.

**Invariants.**
- Every manifest tool declares `resultOrigin` and `reach`; a tool nobody declared is `user`.
- No `user`-origin result reaches the model unescaped, in the turn that ran it or a later one.
- No tool with `reach: 'external'` runs without a human-approved proposal.
- Model output renders no image and no link to an unlisted host.

**Adding a tool.** Declare `resultOrigin` honestly — anything that echoes user text, even a
name, is `user`. A tool that sends anything outside the deployment is `external` and must be
`write` or `destructive` risk, so it goes through the approval gate.

**Do not use** the wrapper as the only defence on a surface that also has an unapproved
`external` tool: wrapping lowers the odds, removing a leg removes the attack.

Related: [threat-model.md](../security/threat-model.md) (the ingested-document adversary),
[harness-lens.md](./harness-lens.md) (the approval gate).
