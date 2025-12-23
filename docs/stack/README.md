# Velociraptor Stack

Technology decisions for the Velociraptor template.

## Quick Reference

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Framework | SvelteKit |
| Database | PostgreSQL (Neon) + Neo4j |
| ORM | Drizzle |
| Auth | Lucia |
| Styling | UnoCSS + Bits UI |
| Validation | Valibot + Superforms |
| Hosting | Vercel |

## Documentation

### Core

| Doc | Contents |
|-----|----------|
| [Core](./core.md) | Runtime, framework, database, storage, caching, deployment |
| [UI](./ui.md) | Styling, components, state, validation, forms |
| [Auth](./auth.md) | Session-based authentication |
| [API](./api.md) | API patterns, services, i18n, background jobs |

### Features

| Doc | Contents |
|-----|----------|
| [SEO](./seo.md) | Traditional SEO and GEO for AI search |
| [Logging](./logging.md) | Structured logging and observability |
| [Notifications](./notifications.md) | Multi-channel notification system |
| [GDPR](./gdpr.md) | Privacy compliance and data protection |

### Related

| Doc | Contents |
|-----|----------|
| [Security](../security.md) | Security practices, headers, rate limiting |
