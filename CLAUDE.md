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


### Key Patterns

- **Svelte 5 Runes**: Use `$state`, `$derived`, `$effect` for reactivity
- **Server separation**: All server code in `$lib/server/` (auto-blocked from client)
- **Mobile-first fluid design**: Typography and spacing use `clamp()`
- **Container queries**: Components adapt to container, not viewport

## Documentation

| Path | Contents |
|------|----------|
| `docs/foundation/` | PRD, architecture, and security baseline |
| `docs/stack/` | Technology decisions and configuration |
| `docs/blueprint/` | Implementation designs and feature specs |

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
