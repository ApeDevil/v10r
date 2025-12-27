# Documentation

Velociraptor documentation organized into three layers: project foundation, stack decisions, and implementation blueprints. Start with foundation to understand the vision, move to stack to see what we use, then reference blueprint for how to build.

## Directory Structure

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| **[foundation/](./foundation/)** | Core project vision, architecture principles, and security baseline | • [PRD.md](./foundation/PRD.md) - project concept and goals<br>• [codebase-architecture.md](./foundation/codebase-architecture.md) - SvelteKit structure patterns<br>• [security.md](./foundation/security.md) - auth, validation, rate limiting |
| **[stack/](./stack/)** | Technology decisions and vendor choices | • [primary/](./stack/primary/) - runtime, framework, database, auth, UI, hosting<br>• [features/](./stack/features/) - API, AI/LLM, SEO, logging, notifications, GDPR<br>• [vendors.md](./stack/vendors.md) - provider matrix and cost analysis |
| **[blueprint/](./blueprint/)** | Implementation designs and feature specifications | • [app-shell.md](./blueprint/app-shell.md) - layout, sidebar, navigation<br>• [pages.md](./blueprint/pages.md) - route structure and showcase pages<br>• [middleware.md](./blueprint/middleware.md) - hooks, CORS, security headers<br>• [auth.md](./blueprint/auth.md) - Better Auth setup and flows<br>• [forms.md](./blueprint/forms.md) - Superforms + Valibot patterns<br>• [state.md](./blueprint/state.md) - Svelte 5 runes and reactivity<br>• [rate-limiting.md](./blueprint/rate-limiting.md) - endpoint protection strategies |
