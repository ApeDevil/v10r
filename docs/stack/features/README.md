# Features

Cross-cutting capability choices. These decisions affect multiple parts of the application but aren't foundational infrastructure.

## Contents

| File | Main Topics |
|------|-------------|
| **[api.md](./api.md)** | • API style: REST + Server Actions (SvelteKit-native)<br>• API docs: OpenAPI with Scalar UI<br>• Background jobs: Server Actions, QStash, Inngest<br>• i18n: svelte-i18n (ICU format, lazy loading) |
| **[ai-llm.md](./ai-llm.md)** | • Pipeline flow vs Graph flow mental model<br>• Framework: Vercel AI SDK (default) vs LangChain (agents)<br>• RAG without LangChain<br>• Stack integration: Neo4j, Groq, Mistral, Together AI |
| **[seo.md](./seo.md)** | • Traditional SEO: SSR, meta tags via svelte-meta-tags<br>• Sitemap: dynamic `/sitemap.xml` endpoint<br>• Structured data: JSON-LD schemas<br>• GEO: AI search optimization (+22% stats, +37% quotations) |
| **[logging.md](./logging.md)** | • Logger: Pino (5x faster than Winston)<br>• Error tracking: Sentry SDK<br>• Structured logging: queryable JSON objects<br>• AI logging: never log prompts/responses (PII) |
| **[notifications.md](./notifications.md)** | • Platform: Novu (open-source, multi-channel)<br>• Email: Resend, Push: Web Push/FCM, In-app: WebSocket<br>• Digests: batch events with step.digest()<br>• Toasts: svelte-french-toast |
| **[gdpr.md](./gdpr.md)** | • Consent: cookie banner, block scripts until opt-in<br>• User rights: access, export, deletion<br>• AI data processing: separate consent, provider transparency<br>• Retention: logs 30 days, analytics 26 months |
