# CLAUDE.md

## Project Overview

Velociraptor (v10r) is a full-stack template/test-sandbox focused on performance and lightweight deployment. The project simultaneously serves as documentation, a test environment, and a reusable template for new projects.


## Stack

| Layer | Technology | Docs |
|-------|------------|------|
| Container | Podman | `docs/stack/core/podman.md` |
| Runtime | Bun | `docs/stack/core/bun.md` |
| Framework | SvelteKit 2 + Svelte 5 | `docs/stack/core/sveltekit.md`, `docs/stack/core/svelte.md` |
| Database | PostgreSQL (Neon) + Neo4j (Aura) | `docs/stack/data/postgres.md`, `docs/stack/data/neo4j.md` |
| ORM | Drizzle | `docs/stack/data/drizzle.md` |
| Auth | Better Auth (session-based) | `docs/stack/auth/better-auth.md` |
| Styling | UnoCSS + Bits UI | `docs/stack/ui/unocss.md`, `docs/stack/ui/bits-ui.md` |
| Validation | Valibot + Superforms | `docs/stack/forms/valibot.md`, `docs/stack/forms/superforms.md` |
| Code Quality | Biome | `docs/stack/quality/biome.md` |
| Container | Podman | `docs/stack/core/podman.md` |
| Hosting | Vercel | `docs/stack/ops/deployment.md` |
| Storage | Cloudflare R2 | `docs/stack/data/r2.md` |
| i18n | svelte-i18n | `docs/stack/i18n/svelte-i18n.md` |
| AI | Vercel AI SDK | `docs/stack/ai/ai-sdk.md` |
| 3D | Three.js + Threlte | `docs/stack/features/3d-web.md` |


## Architecture

The project uses a self-documenting architecture where showcase pages serve as documentation, tests, and templates simultaneously. If a showcase page works, the feature is proven functional.

## Local Development

**Container-first architecture** - the host machine stays clean.

| Host Machine | v10r Container |
|--------------|----------------|
| Only Podman installed | Bun, SvelteKit, all dependencies |
| No node_modules | node_modules lives here |
| No runtime installed | Runtime executes here |
| Source code (mounted) | Source code (via volume) |

### Key Principles

1. **Never install on host** - No `bun install`, `npm install`, or any package manager commands on the host machine
2. **Container has everything** - All tools, dependencies, and runtime are inside the v10r container
3. **Databases are remote** - PostgreSQL (Neon) and Neo4j (Aura) are cloud-hosted, not containerized locally
4. **Dependencies via package.json** - Add dependencies to `package.json`, then rebuild/restart container

### Workflow

```bash
# Start development (from host)
podman-compose up -d

# Container runs: bun install && bun run dev
# Access app at http://localhost:5173

# Add a new dependency (edit package.json, then restart)
podman-compose restart app
```


## Documentation

See [`docs/README.md`](docs/README.md) for the full documentation index.

### README Structure

Each documentation directory has a README.md that serves as a **navigation hub**:

1. **Brief intro** (2-3 sentences) - directory purpose only
2. **Topic table** - each file with its main topics as bullet points

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
| Real-world technology research, community practices | **scout** |

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
- **scout**: "how do people actually use", "what problems do teams hit", "is this production-ready", "find implementations"


## Skills Policy

**Skills provide post-training knowledge** for technologies, patterns, and best practices that may be newer than your training cutoff or commonly misunderstood.

### When to Use Skills

**Proactively invoke skills** when working with:
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) → `svelte5-runes`
- SvelteKit routes, load functions, rendering → `sveltekit`
- Forms with Valibot + Superforms → `valibot-superforms`
- Drizzle ORM schemas and queries → `drizzle`
- Neon PostgreSQL serverless patterns → `db-relational`
- Neo4j graph database patterns → `db-graph`
- Cloudflare R2 file storage → `db-files`
- Better Auth setup and patterns → `better-auth`
- UnoCSS styling and configuration → `unocss`
- Biome linting and formatting → `biome`
- Security patterns, CSRF, injection, headers → `security`
- AI/LLM integration, streaming, prompts, tool calling → `ai-tools`
- Three.js, Threlte, 3D scenes, GLTF, physics → `3d`

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
| db-relational | Neon PostgreSQL serverless patterns |
| db-graph | Neo4j Aura graph database patterns |
| db-files | Cloudflare R2 file storage patterns |
| better-auth | Better Auth session-based authentication |
| unocss | UnoCSS atomic CSS with Bits UI |
| biome | Biome linter and formatter configuration |
| security | Security patterns, CSRF, injection, headers, rate limiting |
| ai-tools | Vendor-agnostic LLM integration, Vercel AI SDK, streaming, caching |
| 3d | Three.js + Threlte patterns, physics, WebGL/WebGPU |
