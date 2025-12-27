# Foundation

Core project vision and architecture principles. Start here to understand what Velociraptor is and how it's structured.

## Contents

| File | Main Topics |
|------|-------------|
| **[PRD.md](./PRD.md)** | • Project concept: documentation, test-sandbox, template<br>• Stack overview: podman, bun, sveltekit<br>• Goals: speed, clean codebase, flexible UI, mobile/desktop optimization<br>• Requirements: user management, versatile DB setup, API gateway, i18n<br>• Responsive strategy: mobile-first fluid responsive design |
| **[codebase-architecture.md](./codebase-architecture.md)** | • Official SvelteKit structure (`src/lib/`, `src/routes/`, `static/`)<br>• Svelte 5 runes: `$state`, `$derived`, `$effect`<br>• Server/client separation: `$lib/server` import blocking<br>• Page options: `prerender`, `ssr`, `csr` configuration<br>• Hooks: `handle`, `handleFetch`, `handleError`<br>• Large project patterns: MVC-style, tRPC integration, feature-based, route-centric<br>• Path aliases and `$lib` directory<br>• Rendering modes: SSR, SSG, SPA, no-JS |
