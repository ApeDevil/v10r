---
name: Dead code patterns — Velociraptor
description: Recurring residue patterns found in audits (2026-04-25)
type: project
---

## schema/core.ts — orphaned barrel

`src/lib/server/db/schema/core.ts` re-exports `./ai`, `./auth`, `./jobs`, `./rag` but is NOT exported from `schema/index.ts` and has zero direct importers. The same subsets are already in schema/index.ts individually.

## resumeFromProposalId — declared-but-unimplemented stub

In `src/lib/server/ai/chat-orchestrator.ts`: `ChatInput.resumeFromProposalId` (line 84) is declared in the type, present in the Valibot validation schema (`src/lib/server/ai/validation.ts` line 95), and forwarded from the chat API endpoint (`src/routes/(shell)/api/ai/chat/+server.ts` line 43) — but the field is never destructured or used inside `orchestrateChatInner`. The comment says "The orchestrator can look up the proposal's cached execution result" — this is a TODO, not a feature.

## orchestrateChatInner — three-path duplication

`src/lib/server/ai/chat-orchestrator.ts` lines 224–891: three execution paths (llmwiki, retrieval, plain) each independently assemble `PipelinePromptEvent`. The `isDevOrAdmin` + `promptEvent.systemPromptHash` logic is copy-pasted, with a divergence: the llmwiki path uses a length-only hash (`sys:${systemPrompt.length.toString(16)}`) at line 447, while the rawrag path uses a djb2-style hash at line 637. The whole function is 667 lines.
