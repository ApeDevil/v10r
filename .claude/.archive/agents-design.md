# Agent Design — `.claude/agents/`

The normative spec for how a v10r subagent file is built and why. Every rule here is load-bearing — if you change one, read its "why" first. History of how this design evolved lives in git, not here.

## The operating reality

Every design decision below follows from five facts about how subagents actually run:

1. **A subagent's context contains exactly four things**: the delegation prompt from the parent, this file's markdown body (its entire system prompt), basic environment info, and any preloaded skills (plus CLAUDE.md, which loads in the project directory). No parent conversation history, no sibling output, no auto-memory. The agent file must therefore carry all project knowledge the agent needs cold.
2. **All agent descriptions load into the orchestrator's context every session.** Description weight is a per-session tax on every conversation, whether or not the agent is used. Descriptions must be as short as routing reliability allows.
3. **A subagent's final message lands in the parent's context and stays there** for every subsequent turn — re-read and re-billed each turn, and capable of crashing the session outright when wide fan-outs each return transcripts (anthropics/claude-code#23463). Return size is a first-class design concern.
4. **The parent is the only router.** Subagents cannot spawn subagents; a hand-off target (`→ arty`) is a literal token the parent reads in the report and acts on next turn. Hand-offs are advisory, not executional.
5. **The first tokens of the system prompt carry disproportionate weight.** The model anchors identity, constraints, and procedure there. Front-load what must never be violated; push reference material down.

## File anatomy

```
---
name: <kebab-id>
description: "<trigger prose>\n\nExamples:\n\n<example>…</example>…"
tools: <explicit allowlist>
model: <tier>
color: <display>
skills: <preloaded skills>        # optional
memory: project                   # optional
maxTurns: 40                      # web-research agents only
---
You are <NAME> with a soul: "<motto>".
Your [
- Role: <identity>
- Mandate: <territory owned>
- Duty: <deliverable>
]

# Principles (Core Rules)      ← positive imperatives only
# Boundaries & Constraints     ← out-of-scope routing, prohibitions, escalations
# Method                       ← numbered procedure, ≤5 steps
# Priorities                   ← single ordered tradeoff chain
<tactical reference sections>  ← tables, checklists, Output Shape, Project Context
<return-discipline line>
<docs-navigation line>
# Agent Memory                 ← only when memory: project
```

## Frontmatter

**`name`** — kebab-case; identity comes from this field, not the filename.

**`description`** — the routing contract. See its own section below; it is the most consequential field in the file.

**`tools`** — always an explicit allowlist. Omitting the field grants ALL tools — the opposite of what intuition suggests. Tool restriction is the strongest stop condition available: removing Edit/Write from a detection-only agent (clyn, laly) makes over-reach physically impossible, which no prompt instruction can guarantee. Read-only consults get `Read, Glob, Grep, WebFetch, WebSearch`; only agents whose job is producing artifacts (aiy, svey, tesy for test files, cony for locale files) get write tools. `memory: project` independently grants writes to the agent's memory directory, so a "read-only" agent with memory can still persist patterns.

**`model`** — current convention: `opus` for deep-reasoning consults, `sonnet` for the web researchers (resy, scout). Open question, deliberately unresolved: with session models above Opus available, a hardcoded `opus` is a ceiling rather than a floor — `inherit` for the reasoning agents and `sonnet` for mechanical work (buny, clyn) is the candidate revision.

**`skills`** — preloaded in full at agent startup. List only skills the agent will actually exercise; each one is token weight on every invocation.

**`memory: project`** — opt-in persistent memory under `.claude/agent-memory/<name>/`. Any agent that accumulates project-specific judgment (false-positive patterns, voice decisions, verified-safe exceptions) gets it; stateless researchers (resy, scout) don't. Requires a matching `# Agent Memory` body section (see below).

**`maxTurns`** — runaway ceiling, currently 40 on resy and scout. Open-ended web research is the documented runaway mode (a research subagent ran 12+ hours unsupervised, anthropics/claude-code#61405). Code-bound agents don't need it; their work is bounded by the repo.

## The description field

The description is written **for the orchestrator, not the agent** — it is the only thing the router sees when deciding where a task goes. It has three parts, in order:

1. **Trigger prose** — *when* to invoke, not what the agent is. "Use this agent when/for…" followed by the concrete task shapes and a trigger vocabulary that is mutually exclusive with every sibling's. Routing fails when descriptions read like résumés ("expert in X") instead of dispatch rules ("use when X"). Where two agents share a border, the prose names the border and the sibling explicitly ("arty styles the elements; laly arranges them").
2. **One representative positive example** — a single `<example>` block (Context / user / assistant). One is enough: positive examples are largely redundant with the trigger prose, and each extra one is a per-session tax (fact 2). The full-roster trim from 4–6 examples to this shape reclaimed ~2.7K tokens per session with no routing signal lost.
3. **All counter-examples** — `<example>` blocks marked `Counter-example (NOT <name>)`, each showing a request that *sounds like* this agent's domain but routes to a sibling. These carry the highest-leverage routing signal and are never cut. They use routing-positive form ("route to cony"), never prohibition form ("do not handle copy") — negative self-description in a high-attention position strengthens the failure mode it names (Waluigi Effect / pink-elephant problem; rejected explicitly, along with "shadow" taglines, on the same evidence).

**Format**: one double-quoted YAML scalar with `\n` escapes, uniform across all files. (Unquoted scalars containing colons break strict YAML parsers; mixed escape styles caused exactly that before unification.)

**Coupling**: the CLAUDE.md Agent Delegation Policy keyword table is the second routing surface and is synced **by hand**. Every description change checks the table; every table change checks the description. When domain ownership moves between agents (as when cony took words from arty/uxy), grep *all* descriptions and bodies for stale hand-off targets — a stale `→ uxy` in a sibling's counter-example is a live misrouting instruction.

## The body

Reading flow, in order of attention: identity → positive rules → negative rules and routing → procedure → tradeoffs → tactical reference. The seed (everything through Priorities) orients the agent; everything after is reference material it consults when relevant.

### Seed: soul + bracket block

```
You are CLYN with a soul: "Reveal what shouldn't exist".
Your [
- Role: Residue Detector — dead code, unused exports, …
- Mandate: prove what is unused; produce evidence with file:line references
- Duty: detect and triage; never delete, edit, or refactor
]
```

- **Soul** — 4–8 words. A self-correction line the model can return to under pressure ("does this serve my soul?").
- **Role / Mandate / Duty are three different layers, not synonyms.** Role is identity, Mandate is the territory owned, Duty is the deliverable shipped. No overlap between them.

### `# Principles (Core Rules)`

Positive-framed imperatives with concrete objects. Not "be careful with X" — "verify X via Y before Z." No `Never` clauses here; every prohibition lives in Boundaries & Constraints so the model reads all refuse-and-route content in one place.

### `# Boundaries & Constraints`

Three entry types in fixed order:

```
- Out of scope: <topic> → <agent-name>     (jurisdictional hand-offs)
- Forbidden: <absolute prohibition>         (behavioral hard lines)
- Escalate to user when: <condition>        (decisions the agent must not make)
```

This section is dual-audience: it gives the agent its stop-and-report signal, and it gives the parent a structured hand-off recommendation (fact 4). Consolidating it fixed the two highest-leverage fleet failure modes — the orchestrator routing wrong, and an agent over-reaching into a sibling's territory.

### `# Method`

Numbered procedure, **≤5 steps**, from input to output. Procedural memory is short; longer lists get ignored.

### `# Priorities`

A single ordered chain (`Correctness > Query performance > Schema clarity > Theoretical purity`). This is the tiebreaker the model returns to when stakes conflict — one line, no commentary.

### Tactical reference sections (optional, agent-specific)

Decision tables, review checklists, threshold tables with sources, `Project Context` blocks (the project gotchas a cold-started agent cannot know — fact 1), `Quality Gates`, and `What NOT to Flag` lists for detection agents (framework-required exports, showcase-page conventions — the known false-positive space).

Agents whose report is their product (clyn, laly, scout, secy) define an explicit **`# Output Shape`** — a fenced template with severity/confidence tiers and a closing "Not flagged (and why)" section. A templated report is synthesizable by the parent and trustworthy to the human.

### Return discipline

Every agent **without** an Output Shape carries this line verbatim near the end of the body:

> Return findings and conclusions, never raw tool output — no pasted grep results, file dumps, or full logs. Lead with what most deserves attention.

Why this and not a word cap: the failure mode is transcript-dumping into the parent context (fact 3), not length per se. For audit agents the full report *is* the deliverable, read by a human — truncating a security audit to protect context damages the product to protect the plumbing. When a scripted fan-out needs token budgets, they go in the delegation prompt for that run, never in the agent file.

### Closing conventions

- **Docs navigation**: `Navigate docs/ via directory README indexes. Never grep blindly.` — the project's index-first docs convention, restated because the agent starts cold.
- **`# Agent Memory`** (memory agents only): names the absolute memory path, mandates a concise `MEMORY.md` index (200-line limit) with topic files for detail, and restricts saves to stable, confirmed patterns — not session findings, speculation, or anything already in CLAUDE.md.

## Roster rules

- **One job per agent.** If the Mandate needs two sentences, it's two agents. Kitchen-sink agents misroute and lose focus.
- **Mutually exclusive trigger vocabulary.** The roster is large (19) and deliberately so; what makes a large roster safe is precisely this discipline plus counter-examples plus the CLAUDE.md MUST-delegate table. (The community "3–4 agent ceiling" claim assumes pure auto-delegation with vague descriptions — i.e., none of these mitigations.) The borders to watch for misroutes: archy↔ary↔sys and arty↔laly↔uxy↔cony.
- **Detection agents never edit.** Enforced by tool allowlist, not prompt. Their reports end every finding with a named hand-off.
- **Splits are dimensional, not topical.** archy/ary/sys split architecture by *altitude* (general / static-spatial / dynamic-temporal); arty/laly/uxy/cony split UI by *dimension* (looks / arrangement / behavior / words). A new agent must name which existing agent's territory it carves and along which dimension.

## Adding or changing an agent — checklist

1. Write the body to this spec: seed → Principles → B&C → Method (≤5) → Priorities → tactical reference → return discipline (or Output Shape) → docs line → memory section if applicable.
2. Write the description: trigger prose with sibling borders named, one positive example, counter-examples for the likeliest misroutes. Double-quoted, `\n` escapes.
3. Add the trigger line (with scope-hint parenthetical) to the CLAUDE.md Agent Delegation Policy table — two registries, synced by hand.
4. Update *siblings*: their B&C `Out of scope` lines and counter-examples must point at the new agent wherever it takes territory from them. Grep all of `.claude/agents/` for the moved topics.
5. Explicit `tools` allowlist; `maxTurns` if it does open-ended web work; `memory: project` + memory section if it accumulates judgment.
6. Verify: frontmatter parses (`yaml.safe_load`), `name`/`description` present, no stale hand-off targets, description length proportionate to routing value.

## Open questions

- **Model field**: move reasoning consults to `inherit`, mechanical agents to `sonnet` (see Frontmatter → model).
- **Delegation briefing**: CLAUDE.md does not yet codify the four-element delegation message (objective; context — file paths, decisions already made; expected output; boundaries with what the next agent handles). The cold-start problem (fact 1) is the one thing agent files cannot fix; the orchestrator's prompt is where it must be solved.

## References

- [Claude Code — Create custom subagents (official docs)](https://code.claude.com/docs/en/sub-agents) — frontmatter fields, description-as-routing-rule, tool allowlists
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — four-element delegation messages; output-format contracts
- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — distilled returns; context isolation as the primary delegation benefit
- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic blog — How and when to use subagents in Claude Code](https://claude.com/blog/subagents-in-claude-code) — proliferation anti-pattern
- [Anthropic — Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — positive instructions outperform negative
- [anthropics/claude-code#23463](https://github.com/anthropics/claude-code/issues/23463) — parallel-subagent context overflow crash (return-discipline rationale)
- [anthropics/claude-code#61405](https://github.com/anthropics/claude-code/issues/61405) — runaway research subagent (maxTurns rationale)
- [The Waluigi Effect — Alignment Forum](https://www.alignmentforum.org/posts/D7PumeYTDPfBTp3i7/the-waluigi-effect-mega-post) — shadow-tagline rejection
- [Pink Elephant Problem — eval.16x.engineer](https://eval.16x.engineer/blog/the-pink-elephant-negative-instructions-llms-effectiveness-analysis) — counter-example form rationale
- [claudekit.cc — Subagents deep dive](https://claudekit.cc/blog/vc-04-subagents-from-basic-to-deep-dive-i-misunderstood) — "context collectors, not implementers"
- [hidekazu-konishi.com — Subagents and orchestration guide](https://hidekazu-konishi.com/entry/claude_code_subagents_and_orchestration_guide.html) — cold-start under-briefing; verbose returns; tools-omission default
- [wshobson/agents](https://github.com/wshobson/agents), [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents), [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — collection conventions surveyed

---

*This spec was distilled from four optimization passes (2026-04-27 → 2026-06-12); the pass-by-pass changelog lives in this file's git history as `agents-optimization.md`.*
