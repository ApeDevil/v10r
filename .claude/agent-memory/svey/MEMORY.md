# SVEY Memory Index

- [Chat transport grounding flags](feedback_chat_transport_grounding.md) — useLlmwiki/useRetrieval are client-optional booleans; widgets must set them; rag-chat reactive-getter pattern is canonical
- [Admin nav dual registry](project_admin_nav_dual_registry.md) — admin nav lives in inline groups array (AdminSidebar) AND nav.ts adminNavItem (global dropdown); edit both; access/ is the in-section tab-bar precedent
- [Account sub-pages pattern](project_account_subpages_pattern.md) — account/* sub-areas = Card link on account/+page.svelte (not app tab); auth pages client-call-driven not Superforms; route segments kebab spelled-out (auth/two-factor not 2fa)
- [Env + primitives reference](reference_env_and_primitives.md) — env via $env/dynamic/private + requireEnv (no PUBLIC_/static); VERCEL_ENV preview-flag in server load; Input forwards arbitrary attrs; qrcode server-side only
