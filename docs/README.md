# Documentation

Velociraptor documentation organized into three layers: project foundation, stack decisions, and implementation blueprints. Start with foundation to understand the vision, move to stack to see what we use, then reference blueprint for how to build. For a cross-cutting view of how all layers fit together at runtime, see [system-abstraction.md](./system-abstraction.md). For the spatial map of the repository — where code lives and where new code goes — see [codebase-organization.md](./codebase-organization.md).

## Directory Structure

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| **[foundation/](./foundation/)** | Core project vision, principles, and architecture | • [PRD.md](./foundation/PRD.md) - project concept and goals<br>• [principles.md](./foundation/principles.md) - decision constraints that drive stack choices<br>• [architecture.md](./foundation/architecture.md) - SvelteKit structure patterns |
| **[stack/](./stack/)** | Technology decisions and vendor choices | • [core/](./stack/core/) - runtime, framework, database<br>• [auth/](./stack/auth/) - authentication<br>• [ui/](./stack/ui/) - styling, components<br>• [capabilities/](./stack/capabilities/) - API, AI/LLM, SEO, notifications, GDPR<br>• [vendors.md](./stack/vendors.md) - provider matrix and cost analysis |
| **[blueprint/](./blueprint/)** | Implementation designs and feature specifications | • [ai/](./blueprint/ai/) - AI assistant, layered RAG (llmwiki + rawrag), TOON format<br>• [app-shell/](./blueprint/app-shell/) - layout, sidebar, navigation<br>• [pages.md](./blueprint/pages.md) - route structure and showcase pages<br>• [middleware.md](./blueprint/middleware.md) - hooks, CORS, security headers<br>• [auth.md](./blueprint/auth.md) - Better Auth setup and flows<br>• [forms.md](./blueprint/forms.md) - Superforms + Valibot patterns<br>• [state.md](./blueprint/state.md) - Svelte 5 runes and reactivity<br>• [abuse/](./blueprint/abuse/) - anti-abuse: ALTCHA captcha, honeypot, rate limits, AI token budget |
