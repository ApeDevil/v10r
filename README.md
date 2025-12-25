# Velociraptor
Is a full stack with focus of performance and lightweight with good free tier service options!

> Fast and dangerous (in a good way).

## Why "Velociraptor"?

- **Veloci-** → "Velocity" → Speed (Bun is fast, Svelte is fast, containers are lightweight)
- **-raptor** → The dinosaur → Cool factor + a bit dangerous/experimental (it's a test project)
- **V** connection → **V**elocity + S**v**elte both share that V sound
- The actual dinosaur name means **"swift thief"** in Latin (velox = swift, raptor = robber/thief)


## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Host Machine (macOS / Linux / Windows)                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Podman Container: Velociraptor                        │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Bun + SvelteKit + adapter-bun                   │  │  │
│  │  │                                                 │  │  │
│  │  │  DEV:  bun run dev    (hot reload)              │  │  │
│  │  │  PROD: bun run build && bun run preview         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  Volume: ./src → /app/src  (live editing)             │  │
│  │  Port: 5173 (dev) / 3000 (prod)                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Editor: VS Code → edits files on host                      │
│          Changes sync instantly via volume mount            │
└─────────────────────────────────────────────────────────────┘
```

## Stack

**Podman + Bun + SvelteKit** with relational database, graph database, and object storage.

See [docs/stack/README.md](./docs/stack/README.md) for complete technology decisions.

