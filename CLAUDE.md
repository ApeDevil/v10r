# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velociraptor is a full-stack template/test-sandbox focused on performance and lightweight deployment. The project simultaneously serves as documentation, a test environment, and a reusable template for new projects.

**Status:** Pre-scaffold planning phase. No code has been written yet.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Framework | SvelteKit 2 + Svelte 5 |
| Database | PostgreSQL (Neon) + Neo4j (Aura) |
| ORM | Drizzle |
| Auth | Better Auth (session-based) |
| Styling | UnoCSS + Bits UI |
| Validation | Valibot + Superforms |
| Code Quality | Biome |
| Container | Podman |
| Hosting | Vercel |


## Architecture

The project uses a self-documenting architecture where showcase pages serve as documentation, tests, and templates simultaneously. If a showcase page works, the feature is proven functional.


## Documentation

See [`docs/README.md`](docs/README.md) for the full documentation index.

### README Structure

Each documentation directory has a README.md that serves as a **navigation hub**:

1. **Brief intro** (2-3 sentences) - directory purpose only
2. **Topic table** - each file with its main topics as bullet points

Example format:
```markdown
| File | Main Topics |
|------|-------------|
| auth.md | • Better Auth setup, • OAuth providers, • Session management |
| rate-limiting.md | • sveltekit-rate-limiter, • Upstash scaling, • Per-route limits |
```

This ensures findability - scanning a README reveals which file covers any topic.

### Finding Documentation

**MUST DO:** When searching for documentation on any topic:

1. **First** - Read the relevant directory's README.md
2. **Then** - Use the topic table to identify which file(s) cover your topic
3. **Finally** - Read the specific file(s)

Never grep blindly through docs. The READMEs are the index.

## Agent Delegation Policy

**IMPORTANT:** This project uses specialized agents for domain-specific work. You MUST delegate tasks to the appropriate agent rather than handling them directly. Agents provide deeper expertise and keep the main context clean.

### Mandatory Delegation Rules

| When you encounter... | ALWAYS delegate to |
|----------------------|-------------------|
| Database schemas, data models, entity relationships | **daty** |
| SvelteKit routes, load functions, rendering modes | **svey** |
| Security review, auth flows, vulnerability assessment | **secy** |
| System architecture, module boundaries, refactoring | **archy** |
| UI/UX review, forms, error states, accessibility | **uxy** |
| Runtime optimization, package management, Bun config | **buny** |
| Errors, failures, debugging, test failures | **tray** |
| Technical research, technology evaluation, verification | **resy** |
| Documentation writing, README, guides | **docy** |

### Delegation Triggers

DELEGATE when the task involves:
- **daty**: "schema", "table", "migration", "entity", "relationship", "database design", "data model"
- **svey**: "+page", "+layout", "+server", "load function", "SSR", "prerender", "SvelteKit"
- **secy**: "security", "auth", "vulnerability", "threat", "OWASP", "injection", "XSS"
- **archy**: "architecture", "structure", "refactor", "module", "boundary", "design pattern"
- **uxy**: "form", "UI", "UX", "accessibility", "user flow", "error message", "validation display"
- **buny**: "bun", "package.json", "runtime", "bundler", "test runner"
- **tray**: "error", "failure", "exception", "debug", "trace", "not working", "failing"
- **resy**: "research", "evaluate", "compare", "best practice", "is X good for"
- **docy**: "document", "README", "explain", "write docs"

### How to Delegate

Use the Task tool with the appropriate `subagent_type`:
- `subagent_type: "daty"` for data modeling
- `subagent_type: "svey"` for SvelteKit work
- etc.

### Available Agents

| Agent | Model | Domain |
|-------|-------|--------|
| archy | sonnet | Codebase architecture and system design |
| buny | sonnet | Bun runtime optimization |
| daty | sonnet | Data modeling and schema design |
| docy | haiku | Documentation writing |
| resy | sonnet | Research and technology decisions |
| secy | sonnet | Security and threat modeling |
| svey | sonnet | SvelteKit patterns and best practices |
| tray | haiku | Error tracing and debugging |
| uxy | sonnet | UI/UX design |

## Skills Policy

**Skills provide post-training knowledge** for technologies, patterns, and best practices that may be newer than your training cutoff or commonly misunderstood.

### When to Use Skills

**Proactively invoke skills** when working with:
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) → `svelte5-runes`
- SvelteKit routes, load functions, rendering → `sveltekit`
- Forms with Valibot + Superforms → `valibot-superforms`
- Drizzle ORM schemas and queries → `drizzle`
- Better Auth setup and patterns → `better-auth`
- UnoCSS styling and configuration → `unocss`

### Skill Usage Rules

1. **Check skills before implementing** - If the task involves stack technologies, invoke the relevant skill first
2. **Skills override training** - When skill content conflicts with your training, trust the skill
3. **Agents have skills too** - Delegated agents auto-load relevant skills (configured in their frontmatter)

### Available Skills

| Skill | Domain |
|-------|--------|
| svelte5-runes | Svelte 5 reactivity patterns |
| sveltekit | SvelteKit 2 routing and data loading |
| valibot-superforms | Form validation with Valibot v1 + Superforms |
| drizzle | Drizzle ORM schemas, queries, migrations |
| better-auth | Better Auth session-based authentication |
| unocss | UnoCSS atomic CSS with Bits UI |
