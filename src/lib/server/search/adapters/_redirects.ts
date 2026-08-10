/**
 * Hrefs that only redirect to a child (hub pages) — excluded from the index so
 * search never lands a user on a bounce. Mirrors the old `nav/search-pages` set.
 */
export const REDIRECT_HREFS = new Set([
	'/account',
	'/showcases/shell',
	'/showcases/ui',
	'/showcases/forms',
	'/showcases/db',
	'/showcases/auth',
	'/showcases/ai',
	'/showcases/cycle',
	'/showcases/analytics',
	'/showcases/notifications',
	'/showcases/toolkits',
	'/showcases/forms/basics',
	'/showcases/forms/validation',
	'/showcases/forms/patterns',
	'/showcases/forms/advanced',
	'/showcases/db/relational',
	'/showcases/db/graph',
	'/showcases/db/storage',
	'/showcases/db/cache',
	'/showcases/ui/components',
	'/showcases/ui/splits',
	'/showcases/ui/decorative',
]);
