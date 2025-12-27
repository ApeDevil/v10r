# Primary

Fundamental runtime, framework, and infrastructure choices. These are the load-bearing decisions that shape everything else.

## Contents

| File | Main Topics |
|------|-------------|
| **[core.md](./core.md)** | • Runtime: Bun, SvelteKit, TypeScript<br>• Container: Podman, oven/bun:alpine, MinIO<br>• Data architecture: PostgreSQL (Neon), Neo4j (Aura), R2<br>• Polyglot freshness: cross-database referential integrity<br>• ORM: Drizzle vs Prisma/Kysely<br>• Caching: Vercel Edge, Redis (Upstash)<br>• Code quality: Biome (10-25x faster than ESLint) |
| **[deployment.md](./deployment.md)** | • Tri-target strategy: Vercel Node.js, Vercel Bun, Koyeb container<br>• Adapter selection: adapter-vercel vs svelte-adapter-bun<br>• Platform comparison: cold starts, preview deploys, free tiers<br>• Environment parity across targets |
| **[hosting.md](./hosting.md)** | • Domain: `v10r.io` (numeronym for velociraptor)<br>• Subdomain strategy: primary on Vercel, secondary on Koyeb<br>• Platform configuration: adapters, regions, env vars<br>• DNS configuration |
| **[auth.md](./auth.md)** | • Better Auth vs DIY Sessions comparison<br>• Session-based auth with Drizzle adapter<br>• OAuth 2.0: 20+ providers (GitHub, Google)<br>• 2FA/MFA: TOTP, WebAuthn, passkeys<br>• Cookie caching for performance |
| **[ui.md](./ui.md)** | • Styling: UnoCSS (atomic, smaller than Tailwind)<br>• Components: Bits UI (headless, Svelte-native)<br>• Icons: Iconify (unified API, tree-shakeable)<br>• Validation: Valibot (1 KB) + Superforms |
