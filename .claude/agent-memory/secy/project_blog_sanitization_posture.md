---
name: Blog/Docs HTML Sanitization Posture
description: v10r blog and docs HTML rendering is sanitized once inside the unified pipeline (rehype-sanitize), not in the Svelte renderer
type: project
---

v10r's blog and docs markdown→HTML pipeline sanitizes **once**, server-side, inside the unified rehype chain — `rehype-sanitize` with `blogSanitizeSchema` (extends `defaultSchema`) followed by `rehypeSanitizeStyles` (Shiki-safe CSS allowlist). The Svelte renderer (`Renderer.svelte`) treats `data.html` as already-trusted and renders `{@html}` directly. Sanitization is NOT repeated client-side.

**Why:** Single trust boundary at pipeline output. Cached HTML in Postgres is already safe. Avoids ~50KB sanitize-html shipping to client and re-running every hydration. Matches multi-client-core: pipeline is domain logic, renderer is dumb adapter. Admin-compromise threat model is real (stored content) so render-time sanitizer is the only defense — keeping it server-side and unified means there's exactly one place to audit.

**How to apply:**
- Any future change touching blog/docs HTML output: change the schema in `src/lib/server/blog/sanitize-schema.ts`, never re-add a client-side sanitizer in `Renderer.svelte`.
- `src/lib/utils/markdown.ts` (chat path with marked) is separate — keeps its own sanitize-html step because it's not in the unified pipeline.
- Iframes are disallowed by schema. If embeds ship, add explicit `src` host allowlist in a rehype plugin AND update CSP `frame-src` — defense in depth.
- `remarkRehype({ allowDangerousHtml: true })` is set, so raw HTML in markdown reaches hast — `rehype-sanitize` is the ONLY defense against `<script>` in `.md`. Don't remove it.
- CSP today: `script-src 'self' 'wasm-unsafe-eval'`, no `unsafe-inline`, no `frame-src` (so falls back to `default-src 'self'`). This is meaningful defense in depth — even if sanitization regressed, inline scripts and cross-origin iframes are CSP-blocked.
