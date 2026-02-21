# Documentation

Velociraptor documentation organized into three layers: project foundation, stack decisions, and implementation blueprints. Start with foundation to understand the vision, move to stack to see what we use, then reference blueprint for how to build.

## Directory Structure

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| **[foundation/](./foundation/)** | Core project vision, principles, and architecture | • [PRD.md](./foundation/PRD.md) - project concept and goals<br>• [principles.md](./foundation/principles.md) - decision constraints that drive stack choices<br>• [architecture.md](./foundation/architecture.md) - SvelteKit structure patterns |
| **[stack/](./stack/)** | Technology decisions and vendor choices | • [primary/](./stack/primary/) - runtime, framework, database, auth, UI, hosting<br>• [features/](./stack/features/) - API, AI/LLM, SEO, logging, notifications, GDPR<br>• [vendors.md](./stack/vendors.md) - provider matrix and cost analysis |
| **[blueprint/](./blueprint/)** | Implementation designs and feature specifications | • [app-shell.md](./blueprint/app-shell.md) - layout, sidebar, navigation<br>• [pages.md](./blueprint/pages.md) - route structure and showcase pages<br>• [middleware.md](./blueprint/middleware.md) - hooks, CORS, security headers<br>• [auth.md](./blueprint/auth.md) - Better Auth setup and flows<br>• [forms.md](./blueprint/forms.md) - Superforms + Valibot patterns<br>• [state.md](./blueprint/state.md) - Svelte 5 runes and reactivity<br>• [rate-limiting.md](./blueprint/rate-limiting.md) - endpoint protection strategies |
| **[features/](./features/)** | Implemented features and patterns | • [keyboard-shortcuts.md](./features/keyboard-shortcuts.md) - platform-aware shortcuts, sequences, help modal |
| **[implementation/](./implementation/)** | Implementation records — what shipped, what diverged, what tripped us up | • [database-showcase.md](./implementation/database-showcase.md) - PostgreSQL showcase<br>• [blender3d.md](./implementation/blender3d.md) - Blender → Threlte pipeline |
