# CLAUDE.md

## Project Overview

Velociraptor (v10r) is a full-stack template/test-sandbox focused on performance and lightweight deployment. The project simultaneously serves as documentation, a test environment, and a reference that new projects instantiate through emulation — an AI agent reads v10r's tested patterns and adapts only the pieces needed.

**No backward compatibility required.** This project is in active development with no production users. Do not add migration shims, retired-ID filters, version upgrade paths, or backward-compat hacks. Just change the code directly.


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
| Hosting | Vercel | `docs/stack/ops/deployment.md` |
| Storage | Cloudflare R2 | `docs/stack/data/r2.md` |
| i18n | Paraglide JS | `docs/stack/i18n/paraglide.md` |
| AI | Vercel AI SDK | `docs/stack/ai/ai-sdk.md` |
| 3D | Three.js + Threlte | `docs/stack/capabilities/3d-web.md` |


## Architecture

The project uses a self-documenting architecture where showcase pages serve as documentation, tests, and templates simultaneously. If a showcase page works, the feature is proven functional.

The backend follows a multi-client core pattern: domain modules in `$lib/server/[domain]/` contain pure business logic with no framework imports, so the same functions serve UI form actions, AI SDK tool calls, REST API, and background jobs. Route handlers are thin adapters. See `docs/blueprint/architecture/multi-client-core.md` for the full blueprint.

The AI subsystem includes a Graph RAG retrieval pipeline. See `docs/blueprint/ai/` for architecture details.

### Component-First Rule

**Never use raw HTML elements when a project component exists.** The project has a layered component system in `$lib/components/` — primitives (Button, Input, Textarea, Select, Checkbox, Switch, etc.), composites (LinkCard, etc.), layout, shell, branding, ui, and viz — that enforce consistent styling via design tokens. Always check for an existing component at any layer before reaching for a raw HTML element. Using raw `<input>`, `<button>`, `<select>`, or `<textarea>` bypasses the design system and creates visual inconsistency. Exceptions: `<input type="hidden">` (form data), `<input type="checkbox">` inside table rows (native indeterminate support), `<select>` binding numeric values (Select component only supports strings), and custom interactive regions (palette cards, sort headers) that need specialized styling.

## Local Development

**Container-first architecture** - the host machine stays clean.

| Host Machine | v10r Container |
|--------------|----------------|
| Only Podman installed | Bun, SvelteKit, all dependencies |
| No node_modules | node_modules lives here |
| No runtime installed | Runtime executes here |
| Source code (mounted) | Source code (via volume) |

### Key Principles

1. **Never install on host** - No `bun install` or any package manager commands on the host machine
2. **Container has everything** - All tools, dependencies, and runtime are inside the v10r container
3. **Databases are remote** - PostgreSQL (Neon) and Neo4j (Aura) are cloud-hosted, not containerized locally
4. **Dependencies via package.json** - Add dependencies to `package.json`, then rebuild/restart container

### No CI Pipeline

Solo dev, no deployment — CI is unnecessary overhead. Use `bun run validate` (check + biome + test) locally when needed. Revisit when deploying or collaborating.


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

### Delegation Triggers

DELEGATE when the task involves:
- **daty**: "schema", "table", "migration", "entity", "relationship", "database design", "data model"
- **svey**: "+page", "+layout", "+server", "load function", "SSR", "prerender", "SvelteKit"
- **secy**: "security", "auth", "vulnerability", "threat", "OWASP", "injection", "XSS"
- **archy**: "architecture", "structure", "refactor", "module", "boundary", "design pattern"
- **uxy** (usability — does it work for everyone?): "user flow", "friction", "accessibility", "WCAG", "keyboard", "screen reader", "contrast", "tap target", "affordance", "micro-interaction", "form behavior", "validation display", "loading state", "success state", "error recovery", "error message clarity", "does the user understand"
- **buny**: "bun", "package.json", "runtime", "bundler", "test runner"
- **tray**: "error", "failure", "exception", "debug", "trace", "not working", "failing"
- **resy**: "research", "evaluate", "compare", "best practice", "is X good for"
- **docy**: "document", "README", "explain", "write docs"
- **apy**: "api", "endpoint", "+server.ts", "REST", "GraphQL", "SSE", "streaming", "webhook", "AI tool schema", "response format", "pagination", "versioning", "OpenAPI", "error response", "idempotency", "HMAC", "DataLoader"
- **aiy**: "AI", "LLM", "streamText", "Chat class", "useChat", "tool calling", "RAG", "retrieval", "embedding", "prompt engineering", "system prompt", "model routing", "token budget", "AI SDK", "streaming chat", "agent loop", "stopWhen", "maxSteps", "prompt caching", "prompt injection"
- **tesy**: "test", "coverage", "regression", "spec", "assertion", "mock", "fixture", "flaky", "test design", "find issues", "probe", "audit"
- **scout**: "how do people actually use", "what problems do teams hit", "is this production-ready", "find implementations"
- **arty** (aesthetic — how does it look and feel?): "visual design", "aesthetics", "hierarchy", "spacing", "rhythm", "color", "typography", "polish", "looks off", "feels off", "microcopy tone", "voice", "off-brand", "brand naming", "name this feature/surface/label", "design system fit", "component aesthetics"
- **clyn**: "dead code", "unused export", "unreachable", "duplication", "complexity", "code smell", "audit code", "what can be removed", "is this still used", "remove residue"


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
- API contracts (REST, GraphQL, SSE, webhooks, AI tools), pagination, errors → `api-design`
- AI/LLM integration, streaming, RAG, tool calling, model routing, prompts → `ai-tools`
- Testing patterns, Vitest, mocking, DB testing, AI testing → `testing`
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
| ai-tools | Vercel AI SDK v6, streaming, RAG, tool orchestration, model routing, prompt engineering |
| api-design | API contracts (REST, GraphQL, SSE, webhooks, AI tools), pagination, errors |
| testing | Vitest patterns, SvelteKit mocking, DB testing, AI SDK testing, Svelte 5 state testing |
| 3d | Three.js + Threlte patterns, physics, WebGL/WebGPU |
