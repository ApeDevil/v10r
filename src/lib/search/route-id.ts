/**
 * Site-awareness — shared, client-safe route helpers.
 *
 * A SvelteKit `page.route.id` (e.g. `/[[locale=locale]]/(public)/showcases/forms`) carries
 * route-group `(...)` and optional `[[locale]]` segments and, for dynamic pages, required
 * `[param]` segments. `normalizeRouteId` strips the noise to the locale-bare public path that
 * the search catalog is keyed on, and refuses dynamic routes (which would otherwise carry a
 * concrete slug/id). Pure + dependency-light so BOTH the client chip and the server resolver
 * (`$lib/server/search/page-context.ts`) share one normalization. See
 * `docs/blueprint/ai/site-awareness.md`.
 */
import { navItems } from '$lib/nav';
import { showcases } from '$lib/showcases/registry';

/**
 * `page.route.id` → locale-bare public path (`/showcases/forms`), or `null` when the route has
 * a required dynamic `[param]` segment (we never resolve those — they encode user data). The
 * home route normalizes to `/`.
 */
export function normalizeRouteId(routeId: string | null | undefined): string | null {
	if (!routeId) return null;
	const out: string[] = [];
	for (const seg of routeId.split('/')) {
		if (!seg) continue;
		if (/^\(.+\)$/.test(seg)) continue; // route group: (public), (app)
		if (/^\[\[.+\]\]$/.test(seg)) continue; // optional param: [[locale=locale]]
		if (/^\[.+\]$/.test(seg)) return null; // required dynamic param: [slug], [fileId] → not resolvable
		out.push(seg);
	}
	return `/${out.join('/')}`;
}

/**
 * Client gate (defense-in-depth; the server catalog-membership check is authoritative):
 * never attach page context for the private `/app` and `/admin` namespaces.
 */
export function isSiteAwareRoute(routeId: string | null | undefined): boolean {
	const path = normalizeRouteId(routeId);
	if (path === null) return false;
	return !path.startsWith('/app') && !path.startsWith('/admin');
}

/**
 * Human label for the current route, for the disclosure chip. Resolved from the SAME public
 * registries the server uses (nav + showcases), so the chip names what is actually sent.
 * Returns `null` when the route isn't a known public page → the chip stays hidden (honest
 * "not reading this page" signal). Mirrors — does not replace — the server resolution.
 */
export function resolveRouteLabel(routeId: string | null | undefined): string | null {
	const path = normalizeRouteId(routeId);
	if (path === null || path.startsWith('/app') || path.startsWith('/admin')) return null;

	for (const item of navItems) {
		if (item.href === path) return item.label();
		for (const child of item.children ?? []) {
			if (child.href === path) return child.label();
		}
	}

	for (const card of showcases) {
		if (card.href === path) return card.title;
		for (const sub of card.sublinks ?? []) {
			if (sub.href === path) return sub.label;
			for (const child of sub.children ?? []) {
				if (child.href === path) return child.label;
			}
		}
	}

	return null;
}
