# Velociraptor (v10r)

A containerized full-stack for web dev focused on performance, lightweight deployment, and free-tier friendly services.

> Fast and dangerous (in a good way).

## Why "Velociraptor"?

The requermnets of the stack are performance and lightweight and the 'Velociraptor' repesents those perfectly!

- **Veloci-** → "Velocity" → Speed (Bun is fast, Svelte is fast, containers are lightweight)
- **-raptor** → The dinosaur → Cool factor + a bit dangerous/experimental (it's a test project)
- The actual dinosaur name means **"swift thief"** in Latin (velox = swift, raptor = robber/thief)

## Genesis

Each layer evolves from and is based on the previous:

```
  Foundation (why/constraints) → Stack (what/choices) → Blueprint (how/implementation)
```

1. **[foundation/](./docs/foundation/)** — Source of truth (goals, requirements)
2. **[stack/](./docs/stack/)** — Technology decisions based on PRD
3. **[blueprint/](./docs/blueprint/)** — Implementation specs & strategy based on stack


## Getting Started

```bash
cp .env.example .env          # fill in DATABASE_URL
podman compose up -d           # start container
podman exec v10r bun run db:setup   # bootstrap DB (extensions → migrate → RAG → Neo4j)
podman exec v10r bun run dev --host 0.0.0.0
```

## Local Development

Clean host system + portable setup

```
┌───────────────────────────────────────────┐
│  Host Machine                             │
│  ┌───────────────────────────────────┐    │
│  │  Podman Container (v10r)          │    │
│  │  ┌───────────────────────────┐    │    │
│  │  │  Bun + SvelteKit          │    │    │
│  │  └───────────────────────────┘    │    │
│  └───────────────────────────────────┘    │
└───────────────────────────────────────────┘
```

## Core Stack

**Podman + Bun + SvelteKit** with relational database, graph database, and object storage.

Podman                  Container (runs everything)
└─ Bun                  Runtime (executes JavaScript)
    └─ SvelteKit        Framework
            └─ Vite     Build tool (SvelteKit's choice, not Bun's)

See [docs/stack/README.md](./docs/stack/README.md) for complete technology decisions.


## Core Idea of the App

**The app documents itself by being itself.**

Every showcase page serves three purposes simultaneously:

| Role | What It Does |
|------|--------------|
| **Documentation** | Explains how the feature works |
| **Test** | Proves the feature works |
| **Template** | Copy-paste starting point |


## v10r(x) — Instances

v10r isn't clone-once scaffolding. It's a continuous template — a living upstream that keeps evolving. Downstream projects are **instances** that take what they need and leave the rest.

The naming follows function-call syntax: `v10r(content or application)` — v10r is the function, the content/application is the variable.

### Examples

| Instance | What it uses |
|---|---|
| `v10r(landing-page)` | SvelteKit, UnoCSS (2 of 18) |
| `v10r(full-platform)` | Everything (18 of 18) |

### Creating a new instance

Shape it to the content. Strip what you don't need, add what you do. The upstream keeps growing — pull new patterns when they're useful.


## Documentation Structure

The `docs/` folder uses an AI-optimized navigation structure. Each directory has a README.md that acts as a **navigation hub** with topic tables showing which file covers what.

**Why this structure:**
- AI agents find the right file faster (README first, then target file)
- More precise information retrieval (no blind grep through all docs)
- Reduces token usage (read index → read specific file, not everything)

**Navigation rule:** Always start at [`docs/README.md`](./docs/README.md), drill down through directory READMEs to find the right file.


## Project Root Structure

| Path | Purpose |
|------|---------|
| `src/` | SvelteKit application source code |
| `static/` | Static assets (served as-is) |
| `docs/` | Project documentation |
| `build/` | Production build output |
| `.svelte-kit/` | SvelteKit generated files |
| `Containerfile.dev` | Dev container definition (Bun + Vite) |
| `compose.yaml` | Podman Compose config (v10r container) |
| `.dockerignore` | Files excluded from container build |
| `.env.example` | Environment variables template |
| `.env` | Local environment variables (git-ignored) |
| `package.json` | Project dependencies and scripts |
| `bun.lock` | Bun lockfile |
| `vite.config.ts` | Vite config (HMR for containers) |
| `svelte.config.js` | SvelteKit config |
| `tsconfig.json` | TypeScript config |
| `drizzle/` | Migration SQL files (committed, applied via `db:migrate`) |
| `drizzle.config.ts` | Drizzle ORM config |
| `CLAUDE.md` | AI agent instructions |
| `.claude/` | Claude Code agents and skills |