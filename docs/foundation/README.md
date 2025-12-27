# Foundation

Core project vision, architecture principles, and security baseline. Start here to understand what Velociraptor is and how it's structured.

## Contents

| File | Main Topics |
|------|-------------|
| **[PRD.md](./PRD.md)** | • Project concept: documentation, test-sandbox, template<br>• Stack overview: podman, bun, sveltekit<br>• Goals: speed, clean codebase, flexible UI, mobile/desktop optimization<br>• Requirements: user management, versatile DB setup, API gateway, i18n<br>• Responsive strategy: mobile-first fluid responsive design |
| **[codebase-architecture.md](./codebase-architecture.md)** | • Official SvelteKit structure (`src/lib/`, `src/routes/`, `static/`)<br>• Svelte 5 runes: `$state`, `$derived`, `$effect`<br>• Server/client separation: `$lib/server` import blocking<br>• Page options: `prerender`, `ssr`, `csr` configuration<br>• Hooks: `handle`, `handleFetch`, `handleError`<br>• Large project patterns: MVC-style, tRPC integration, feature-based, route-centric<br>• Path aliases and `$lib` directory<br>• Rendering modes: SSR, SSG, SPA, no-JS |
| **[security.md](./security.md)** | • Authentication: Better Auth, session-based, Postgres-backed<br>• Input validation: Valibot + Superforms server-side<br>• Rate limiting: **Better Auth's built-in is BROKEN** — use Upstash/sveltekit-rate-limiter<br>• CSRF, XSS, SQL injection protections<br>• Security headers: HSTS, CSP, X-Frame-Options<br>• Secrets management: `.env`, GitLab CI/CD, Vercel env vars<br>• Auth flow diagram<br>• Required rate limits by endpoint type (login: 5/15min, registration: 3/hour, etc.) |
| **[hosting.md](./hosting.md)** | • Domain: `v10r.io` (numeronym for velociraptor)<br>• Subdomain strategy: primary on Vercel, secondary on Koyeb<br>• Platform configuration: adapters, regions, env vars<br>• DNS configuration (TBD) |
