# Velociraptor

A full-stack template focused on performance, lightweight deployment, and free-tier friendly services.

> Fast and dangerous (in a good way).

**Status:** Pre-scaffold planning phase

## Why "Velociraptor"?

- **Veloci-** → "Velocity" → Speed (Bun is fast, Svelte is fast, containers are lightweight)
- **-raptor** → The dinosaur → Cool factor + a bit dangerous/experimental (it's a test project)
- **V** connection → **V**elocity + S**v**elte both share that V sound
- The actual dinosaur name means **"swift thief"** in Latin (velox = swift, raptor = robber/thief)

## Genesis

Each layer evolves from and is based on the previous:

```
  Foundation (why/constraints) → Stack (what/choices) → Blueprint (how/implementation)
```

1. **[foundation/PRD.md](./docs/foundation/PRD.md)** — Source of truth (goals, requirements)
2. **[stack/](./docs/stack/)** — Technology decisions based on PRD
3. **[blueprint/](./docs/blueprint/)** — Implementation specs based on stack


## Local Development

```
┌───────────────────────────────────────────┐
│  Host Machine                             │
│  ┌───────────────────────────────────┐    │
│  │  Podman Container                 │    │
│  │  ┌───────────────────────────┐    │    │
│  │  │  Bun + SvelteKit          │    │    │
│  │  └───────────────────────────┘    │    │
│  └───────────────────────────────────┘    │
└───────────────────────────────────────────┘
```

## Stack

**Podman + Bun + SvelteKit** with relational database, graph database, and object storage.

See [docs/stack/README.md](./docs/stack/README.md) for complete technology decisions.



## Core Idea

**The app documents itself by being itself.**

Every showcase page serves three purposes simultaneously:

| Role | What It Does |
|------|--------------|
| **Documentation** | Explains how the feature works |
| **Test** | Proves the feature works |
| **Template** | Copy-paste starting point |


## Documentation Structure

The `docs/` folder uses an AI-optimized navigation structure. Each directory has a README.md that acts as a **navigation hub** with topic tables showing which file covers what.

**Why this structure:**
- AI agents find the right file faster (README first, then target file)
- More precise information retrieval (no blind grep through all docs)
- Reduces token usage (read index → read specific file, not everything)

**Navigation rule:** Always start at [`docs/README.md`](./docs/README.md), drill down through directory READMEs to find the right file.