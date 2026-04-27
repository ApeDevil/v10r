# Agents Optimization — 2026-04-27

Refactor of all 15 project subagents in `.claude/agents/` to standardize their system prompt structure on a verbose, front-loaded instruction seed. Updated same day to add a `# Boundaries & Constraints` section to every agent and sharpen the arty/uxy split.

## Why

Research across official Claude Code docs and community practitioners (wshobson/agents, VoltAgent, Piebald-AI's reverse-engineered system prompts, Anthropic's harness-design post, claudefa.st, builder.io, PubNub, Addy Osmani, dev.to) converged on a small set of patterns that make subagents reliable:

1. **A subagent's context contains exactly four things**: the prompt string from the parent, the system prompt body, basic environment info, and any preloaded skills. No parent history, no sibling output, no auto-memory. The system prompt's first tokens carry disproportionate weight — the model anchors identity, constraints, and procedure there.
2. **One job per agent**, narrow tools, rich descriptions, templated output. Kitchen-sink agents misroute and lose focus.
3. **Description = trigger, not capability list**. Routing fails when descriptions read like résumés.
4. **Tool restriction is the strongest stop condition**. Removing the Edit tool from a detection-only agent makes harmful action physically impossible — stronger than any prompt instruction.
5. **Body ≤ ~300 words** of procedural content. Longer prompts cause focus loss, not better behavior.

## What we changed

Every agent body now opens with the same seed structure before any tactical detail:

```
You are <NAME> with a soul: "<motto>".
Your [
- Role: <identity>
- Mandate: <territory owned>
- Duty: <deliverable>
]

# Principles (Core Rules)
- <imperative invariants>

# Method
1. <numbered procedure, ≤5 steps>

# Priorities
<ordered tradeoff chain>
```

Design choices:

- **Soul** — 4 to 8 words. Functions as a self-correction line the model can refer back to under pressure ("does this serve my soul?").
- **Bracket block** — Role / Mandate / Duty are three different layers, not synonyms. Role is identity. Mandate is the territory. Duty is the deliverable. No overlap.
- **Principles use imperative verbs + concrete objects.** Not "be careful with X" — "verify X via Y before Z." Constraints stated as `Never X` force routing decisions, not just preferences.
- **Method is procedural, ≤5 steps.** Procedural memory is short; longer lists get ignored.
- **Priorities is a single ordered chain.** This is the tiebreaker line the model returns to when stakes conflict.

## Final souls

| Agent | Soul |
|---|---|
| ARCHY | Order that scales |
| ARTY | Style is necessity, not decoration |
| AIY | Reliable intelligence over impressive demos |
| APY | Rigorous contracts over optimistic hope |
| BUNY | Speed without ceremony |
| CLYN | Reveal what shouldn't exist |
| DATY | Make right queries easy, wrong states impossible |
| DOCY | Turn knowledge into understanding |
| RESY | Curiosity guided by evidence |
| SCOUT | Ground truth from what people actually build |
| SECY | Paranoia with purpose |
| SVEY | The best JavaScript is the JavaScript you don't ship |
| TESY | Prove what's broken — never fix it |
| TRAY | Turn failures into understanding |
| UXY | Make the obvious obvious |

## What we preserved (Pass 1)

The seed replaces only the body's *opening section* (intro + first principles + first method). Each agent's tactical reference content was kept intact below the seed:

- **clyn** — Detection Categories table, What NOT to Flag, Output Shape, Agent Memory (Hand-off Recommendations and Never list later folded into B&C in Pass 2)
- **arty** — Domain Expertise breakdown, Project Context, Quality Gates, Agent Memory (Never list later folded into B&C in Pass 2)
- **aiy** — Review Checklist (AI Surface, SDK Integration, Prompt Quality, RAG Pipeline, Cost and Safety, Specificity)
- **apy** — Operational Readiness table (REST / GraphQL / SSE / Webhooks / AI tools)
- **secy** — Output sections table
- **tesy** — Domain Strategies table, Don't-test list, SvelteKit Mocking snippet
- **scout** — Output Structure template
- **archy / daty** — Deliverables block
- **svey** — Response Order
- All agents — closing `Navigate docs/` line

Frontmatter (name, description, tools, model, color, skills, memory) was not touched — only the markdown body.

## How we did it

1. **Read all 15 agent files** to understand each agent's current scope and personality.
2. **Drafted seeds** following the structure above, preserving each agent's existing soul/motto where it already had one and inventing new ones where it didn't (ARTY, DATY, TESY, UXY).
3. **Translated principles into the new form**: kept the underlying invariants, restated as imperatives with concrete objects.
4. **Compressed Method to 5 steps** maximum (where the original had a Process section, kept its content but tightened to the 5-step shape).
5. **Added Priorities chain** to every agent — most already had a priority line implicit in their intro; we made it explicit and ordered.
6. **Edit-replaced each body** in parallel using the existing body as `old_string` and the new body as `new_string`. Frontmatter untouched. Tactical content (tables, output templates, hand-off rules) re-attached after the seed.
7. **Verified** with a grep over `You are` lines to confirm every agent now opens with the new seed.

## What this is for

The first tokens of a subagent's system prompt are the only place the model is guaranteed to read carefully. By front-loading identity, mandate, constraints, procedure, and tradeoff priority *before* any agent-specific tactical detail, the model anchors on:

- **Who it is** (Role)
- **What it owns** (Mandate)
- **What it ships** (Duty)
- **What is forbidden** (Principles, especially the `Never` clauses)
- **How to proceed** (Method)
- **What wins when stakes conflict** (Priorities)

The tactical sections after the seed (output templates, decision tables, hand-off rules) are reference material the model consults when relevant — they no longer need to do the work of orienting the agent's identity, which the seed now handles.

## Files changed

```
.claude/agents/aiy.md
.claude/agents/apy.md
.claude/agents/archy.md
.claude/agents/arty.md
.claude/agents/buny.md
.claude/agents/clyn.md
.claude/agents/daty.md
.claude/agents/docy.md
.claude/agents/resy.md
.claude/agents/scout.md
.claude/agents/secy.md
.claude/agents/svey.md
.claude/agents/tesy.md
.claude/agents/tray.md
.claude/agents/uxy.md
```

---

## Pass 2 — Boundaries & Constraints section

### Why a second pass

Pass 1 left negative-framed rules scattered across three places:

1. `Never X` clauses inside Principles (most agents)
2. Standalone `# Never` sections (clyn, arty)
3. Hand-off rules inside tactical content (clyn's `# Hand-off Recommendations`)

This dispersal caused two problems the research flagged as the fleet's highest-leverage failure modes:

- **Orchestrator routes to wrong agent** (or handles it itself) — fixed by explicit boundaries with hand-off targets
- **Agent over-reaches into a sibling's territory** — fixed by absolute prohibitions stated up front

Pass 2 consolidates jurisdictional boundaries and absolute behavioral constraints into one section, so the model reads all "what to refuse and where to send it" content at once.

### Section structure

Inserted between `# Principles (Core Rules)` and `# Method` in every agent body:

```
# Boundaries & Constraints
- Out of scope: <topic> → <agent-name>
- Out of scope: <topic> → <agent-name>
- Forbidden: <absolute prohibition>
- Forbidden: <absolute prohibition>
- Escalate to user when: <condition>
```

Three entry types in fixed order: jurisdictional hand-offs, then absolute prohibitions, then escalation triggers. Principles became positive-framed only; every `Never X` clause moved into B&C as `Forbidden: X`.

### arty / uxy split — sharpened

The user clarified the dimensions each agent owns:

| Dimension | ARTY owns | UXY owns |
|---|---|---|
| Visual hierarchy, spacing, rhythm, color, typography | ✓ | — |
| Microcopy *tone* and brand voice | ✓ | — |
| Whitespace as architecture, visual polish | ✓ | — |
| Brand naming (public surfaces) | ✓ | — |
| Microcopy *clarity* (does it convey?) | — | ✓ |
| User flows, friction, step counts | — | ✓ |
| Accessibility (WCAG, keyboard, screen reader, contrast) | — | ✓ |
| Error states, recovery paths, affordances | — | ✓ |
| Form behavior and validation display | — | ✓ |
| Mobile-first constraint adaptation | — | ✓ |

The B&C sections in arty.md and uxy.md mirror this split — each lists the other's territory as out-of-scope with the right hand-off target. The `Component-first UI` rule stays in both (it's a project-wide rule, not a domain rule).

### How Pass 2 was applied

1. **Read all 15 files** in their Pass-1 state.
2. **For each file**, ran one Edit that:
   - Replaced the Principles section, removing every `Never X` line (those moved into B&C as `Forbidden:`)
   - Inserted the new `# Boundaries & Constraints` section between Principles and Method
3. **For arty and clyn**, ran cleanup edits to remove redundant standalone sections:
   - `arty.md`: removed `# Never` (folded into B&C)
   - `clyn.md`: removed `# Hand-off Recommendations` (jurisdictional content folded into B&C `Out of scope:` lines) and `# Never` (folded into B&C `Forbidden:` lines)
4. **Verified** with three grep audits:
   - Every agent contains `# Boundaries & Constraints` (15/15)
   - No `Never` clauses remain inside Principles sections (0 matches)
   - No lingering standalone `# Never` or `# Hand-off Recommendations` sections (0 matches)

### Reading flow after Pass 2

Identity (Soul / Role / Mandate / Duty) → positive rules (Principles) → negative rules and routing (Boundaries & Constraints) → procedure (Method) → tradeoff chain (Priorities) → tactical reference (tables, output templates, agent memory).

### Important: agents are not aware of each other

A subagent's hand-off target (`→ arty`) is just a name string. The subagent does not load arty's system prompt or capabilities — it sees the literal token. Three implications:

1. **Hand-offs are advisory, not executional.** Subagents cannot spawn other subagents. The recommendation goes back to the parent (orchestrator), which decides whether to invoke the named agent next.
2. **The parent is the only router.** B&C sections are written for the orchestrator's eyes as much as the agent's — the orchestrator reads the agent's hand-off recommendation and routes on the next turn.
3. **CLAUDE.md is the closest thing to shared awareness.** Its delegation table maps keywords to agents. Subagents inherit it because CLAUDE.md loads in the project directory; the orchestrator uses it as the routing map.

This means B&C earns its keep by giving the agent itself a clear stop-and-report signal *and* giving the parent a structured hand-off recommendation — both in one section.

### Files changed in Pass 2

All 15 agent files received a `# Boundaries & Constraints` section. Two files received additional cleanup:

- `arty.md` — removed `# Never` section
- `clyn.md` — removed `# Hand-off Recommendations` and `# Never` sections

---

## References

- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — reverse-engineered Claude Code agent-creation prompt
- [wshobson/agents](https://github.com/wshobson/agents) — 184-agent collection, three-tier model routing
- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)
- [claudefa.st sub-agent best practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices)
- [builder.io — Claude Code subagents](https://www.builder.io/blog/claude-code-subagents)
- [Addy Osmani — Code Agent Orchestra](https://addyosmani.com/blog/code-agent-orchestra/)
- [PubNub — Best practices for Claude Code sub-agents (Part I)](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)
- [morphllm — Claude subagents](https://www.morphllm.com/claude-subagents)
