# Velociraptor

A Bun + SvelteKit test project running fully containerized in Podman.

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

| Component | Choice |
|-----------|--------|
| Runtime | Bun (latest) |
| Framework | SvelteKit |
| Adapter | adapter-bun |
| Base Image | oven/bun:alpine |
| Container | Podman + compose |
| Editor | VS Code |
| DB | TBD (SQLite or Postgres container) |
| UI | TBD (Tailwind / Skeleton / DaisyUI) |

## Project Structure

```
velociraptor/
├── src/
│   ├── routes/          # SvelteKit pages & API routes
│   └── lib/             # Shared components & utilities
├── static/              # Static assets
├── Containerfile        # Container build instructions
├── compose.yaml         # Dev environment (podman-compose)
├── package.json
├── svelte.config.js     # adapter-bun config
├── vite.config.ts
└── README.md
```

## What is adapter-bun?

SvelteKit needs an adapter to convert your app for deployment:

```
┌─────────────────┐     ┌─────────────┐     ┌──────────────────────┐
│ SvelteKit App   │────▶│ adapter-bun │────▶│  Native Bun Server   │
│ (your code)     │     │             │     │  (fastest option)    │
└─────────────────┘     └─────────────┘     └──────────────────────┘
```

## Quick Start

```bash
# Start development environment
podman-compose up

# Or run manually
podman build -t velociraptor .
podman run -p 5173:5173 -v ./src:/app/src velociraptor
```

## Development Workflow

1. Start the container: `podman-compose up`
2. Open VS Code and edit files in `src/`
3. Changes hot-reload instantly in the container
4. View app at http://localhost:5173

## Goals

- [x] Plan project structure
- [ ] Scaffold SvelteKit with Bun
- [ ] Create Containerfile
- [ ] Create compose.yaml
- [ ] Test hot reload in container
- [ ] Add database (SQLite/Postgres)
- [ ] Choose UI framework
- [ ] Deploy to free hosting (Fly.io / Railway / Render)

## Free Hosting Options

| Platform | Notes |
|----------|-------|
| Fly.io | Free tier, great for containers |
| Railway | $5 free credit/month |
| Render | Free tier for web services |
| Koyeb | Free tier available |
