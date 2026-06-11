---
name: project-arch-review-2026-06
description: Findings from the 2026-06-11 architecture-adherence review of the multi-client hexagonal core
metadata:
  type: project
---

On 2026-06-11 I reviewed how well the code adheres to the intended multi-client-core architecture (docs/system-abstraction.md, docs/codebase-organization.md).

Top live structural risks found (still true unless code changed since):
- `ai/chat-orchestrator.ts` is ~1174 lines with three near-duplicate streaming branches (useLlmwiki / useRetrieval / non-retrieval), each re-implementing the same persistence scaffold (pre-create assistant msg → onStepFinish saveConversationStep → onFinish updateMessageContent/refreshConversationTokens/chargeTokens). 15 hand-repeated persistence calls in one file.
- Missing `index.ts` barrels: `llmwiki/`, `style/`, `branding/`, `docs/` have NO barrel, so cross-domain callers deep-import internals (e.g. orchestrator imports llmwiki/overview, /search, /verify, /wiki-format, /config). Violates the doc's "cross-domain access is barrel-only" invariant. `db/[domain]/queries|mutations` deep imports are SANCTIONED (not a violation).
- `/api/ai/chat/stream/+server.ts` calls `streamText` inline in the adapter (business logic in route) — parallel minimal path that bypasses the orchestrator entirely.

**Why:** these are the highest-leverage structural debts in the recently-landed AI/chat/search/catalog areas.
**How to apply:** if asked to extend chat/streaming, push for extracting a shared stream-scaffold helper before adding a 4th branch; if adding cross-domain llmwiki calls, create the barrel first.

Doc drift caught: system-abstraction.md "Drift Gap #2" says `checkUserBudget` is dead code — STALE. It is now wired in `/api/ai/chat/+server.ts:35`. Don't trust that gap list without re-checking.
