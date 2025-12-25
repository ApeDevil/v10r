# Velociraptor Stack

Technology decisions for the Velociraptor template.

## Quick Reference

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Framework | SvelteKit |
| Database | PostgreSQL (Neon) + Neo4j |
| ORM | Drizzle |
| Auth | Better Auth (or DIY Sessions) |
| Styling | UnoCSS + Bits UI |
| Validation | Valibot + Superforms |
| Code Quality | Biome |
| Hosting | Vercel |

## Documentation

### Core

| Doc | Contents |
|-----|----------|
| [Core](./core.md) | Runtime, framework, database, storage, code quality, deployment |
| [UI](./ui.md) | Styling, components, state, validation, forms |
| [Auth](./auth.md) | Session-based authentication |
| [API](./api.md) | API patterns, services, i18n, background jobs |
| [Vendors](./vendors.md) | All external services, costs, compliance, alternatives |

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
| [Security](../foundation/security.md) | Security practices, headers, rate limiting |
