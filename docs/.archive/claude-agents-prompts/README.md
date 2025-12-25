# Claude Code Agents

Specialized agent prompts for Claude Code. Each agent has a focused purpose and consistent structure.

## Usage

These agents can be referenced in your root `CLAUDE.md` to enable automatic delegation:

```markdown
<!-- In /CLAUDE.md -->

## Agents

When working on specific domains, delegate to specialized agents:

| Agent | Domain | When to Use |
|-------|--------|-------------|
| @docs/claude/archy.md | Architecture | System design, module boundaries, refactoring |
| @docs/claude/daty.md | Data modeling | Schema design, database choice, migrations |
| @docs/claude/svey.md | SvelteKit | Routes, load functions, rendering modes |
| @docs/claude/uxy.md | UI/UX | Component design, user flows, accessibility |
| @docs/claude/secy.md | Security | Threat modeling, auth flows, vulnerabilities |
| @docs/claude/resy.md | Research | Technology decisions, documentation lookup |
| @docs/claude/tray.md | Debugging | Error tracing, reproduction, root cause |
| @docs/claude/buny.md | Bun | Runtime optimization, Bun-specific features |
```

---

## Agent Catalog

| Agent | Soul | Purpose |
|-------|------|---------|
| **archy** | order that scales | Codebase architecture and system design |
| **buny** | speed without ceremony | Bun runtime specialist |
| **daty** | shape functional systems | Data modeling and schema design |
| **resy** | curiosity guided by evidence | Research and technology decisions |
| **secy** | paranoia with purpose | Security and threat modeling |
| **svey** | performance through understanding | SvelteKit patterns and best practices |
| **tray** | follow the signal | Error tracing and debugging |
| **uxy** | clarity with care | UI/UX design and user experience |

---

## Agent Structure

Each agent follows a consistent format:

```markdown
## [Domain] Agent

**name:** [short-name]

**soul:** [3-4 word essence]

**Role:** One sentence defining purpose.

**philosophy:**
* Belief 1
* Belief 2
* ...

**Principles:**
* Actionable guideline 1
* Actionable guideline 2
* ...

**Rules:**
* Start with [first step]
* Then [second step]
* Then [third step]
* End with [final deliverable]
```

---

## Best Practices

### Token Efficiency

Keep agents lightweight for better composability:

| Weight | Tokens | Use Case |
|--------|--------|----------|
| Lightweight | < 3k | Frequent specialists, fast delegation |
| Medium | 10-15k | Balanced complexity |
| Heavy | 25k+ | Deep domain expertise (use sparingly) |

Heavy agents create bottlenecks in multi-agent workflows. Prefer multiple lightweight agents over one heavy agent.

### Auto-Activation

For reliable automatic delegation, use descriptive terms in the agent table:

```markdown
<!-- Strong activation signals -->
| @docs/claude/secy.md | Security | **MUST USE** for auth, secrets, vulnerabilities |
| @docs/claude/daty.md | Data | Use **PROACTIVELY** for schema changes |
```

### Model Selection

| Model | Best For |
|-------|----------|
| Haiku | Most agents (90% capability, 2x speed, 3x cheaper) |
| Sonnet | Orchestration, complex reasoning |
| Opus | Maximum depth, novel problems |

---

## Orchestration Patterns

### Pattern 1: Orchestrator + Workers

```
┌─────────────────┐
│  Main Session   │  ← Sonnet (orchestrator)
│  (CLAUDE.md)    │
└────────┬────────┘
         │ delegates
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
 [archy]   [daty]   [svey]   [uxy]   ← Haiku (workers)
```

The main session decomposes tasks and delegates to specialists. Each agent works in isolation, returning results to the orchestrator.

### Pattern 2: Sequential Pipeline

```
[resy] → [archy] → [daty] → [svey] → [uxy]
research  design   schema   implement  polish
```

For new features, chain agents in a logical sequence. Each agent's output feeds the next.

### Pattern 3: Parallel Execution

```
         ┌─────────┐
    ┌───▶│  svey   │───┐
    │    └─────────┘   │
────┤    ┌─────────┐   ├───▶ merge
    │───▶│  daty   │───│
    │    └─────────┘   │
    └───▶│  secy   │───┘
         └─────────┘
```

Independent concerns (frontend, backend, security) can run in parallel via the Task tool.

---

## CLAUDE.md Integration

Your root `CLAUDE.md` should reference agents without embedding them:

```markdown
<!-- Good: Reference, don't embed -->
For data modeling decisions, consult @docs/claude/daty.md

<!-- Bad: Bloats context -->
Here is the full daty agent prompt: [500 lines...]
```

### Minimal CLAUDE.md Example

```markdown
# Project: Velociraptor

## Stack
- SvelteKit 2 + Svelte 5
- PostgreSQL (Neon) + Neo4j (Aura)
- Drizzle ORM, Valibot, Superforms

## Commands
- `bun run dev` - Start dev server
- `bun run test` - Run tests
- `bun run check` - Type check

## Agents
See @docs/claude/README.md for specialized agents.

Delegate to agents for:
- Architecture decisions → @docs/claude/archy.md
- Schema changes → @docs/claude/daty.md
- SvelteKit patterns → @docs/claude/svey.md
```

---

## Creating New Agents

1. Copy the structure from an existing agent
2. Keep it under 3k tokens if possible
3. Focus on one responsibility
4. Test auto-activation by observing delegation behavior
5. Refine the description based on when Claude invokes it

---

## References

- [ClaudeLog: Agent Engineering](https://claudelog.com/mechanics/agent-engineering/)
- [How I Use Every Claude Code Feature](https://blog.sshh.io/p/how-i-use-every-claude-code-feature)
- [Multi-Agent Orchestration Patterns](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/)
