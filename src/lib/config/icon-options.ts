/**
 * Single source of truth for admin-selectable icons (blog domains & tags).
 *
 * These are the ONLY icon classes that can be written to the DB
 * (`blog.domain.icon` / `blog.tag.icon`) via the admin picker, and therefore
 * the only lucide icons that cannot be statically extracted from source by
 * UnoCSS. `uno.config.ts` imports this list and spreads it into `safelist` so
 * DB-authored icons always render; the admin picker renders from the same
 * array so the two can never drift.
 *
 * Every entry MUST be a `lucide` class — `presetIcons` only registers the
 * lucide collection (see `uno.config.ts`), and the server validator
 * (`tags/+page.server.ts` ICON_RE) enforces the `i-lucide-*` prefix.
 */
export type IconOption = { name: string; class: string };

export const ICON_OPTIONS: IconOption[] = [
	{ name: 'code', class: 'i-lucide-code' },
	{ name: 'terminal', class: 'i-lucide-terminal' },
	{ name: 'palette', class: 'i-lucide-palette' },
	{ name: 'brain', class: 'i-lucide-brain' },
	{ name: 'box', class: 'i-lucide-box' },
	{ name: 'users', class: 'i-lucide-users' },
	{ name: 'globe', class: 'i-lucide-globe' },
	{ name: 'layers', class: 'i-lucide-layers' },
	{ name: 'zap', class: 'i-lucide-zap' },
	{ name: 'database', class: 'i-lucide-database' },
	{ name: 'book', class: 'i-lucide-book-open' },
	{ name: 'microscope', class: 'i-lucide-microscope' },
	{ name: 'cloud', class: 'i-lucide-cloud' },
	{ name: 'rocket', class: 'i-lucide-rocket' },
	{ name: 'shield', class: 'i-lucide-shield' },
	{ name: 'briefcase', class: 'i-lucide-briefcase' },
	{ name: 'heart', class: 'i-lucide-heart' },
	{ name: 'camera', class: 'i-lucide-camera' },
	{ name: 'music', class: 'i-lucide-music' },
	{ name: 'pen-tool', class: 'i-lucide-pen-tool' },
	{ name: 'cpu', class: 'i-lucide-cpu' },
	{ name: 'wifi', class: 'i-lucide-wifi' },
	{ name: 'key', class: 'i-lucide-key' },
	{ name: 'flag', class: 'i-lucide-flag' },
	{ name: 'compass', class: 'i-lucide-compass' },
	{ name: 'lightbulb', class: 'i-lucide-lightbulb' },
	{ name: 'sparkles', class: 'i-lucide-sparkles' },
	{ name: 'flame', class: 'i-lucide-flame' },
	{ name: 'gem', class: 'i-lucide-gem' },
	{ name: 'trophy', class: 'i-lucide-trophy' },
	{ name: 'container', class: 'i-lucide-container' },
	{ name: 'server', class: 'i-lucide-server' },
	{ name: 'puzzle', class: 'i-lucide-puzzle' },
	{ name: 'wrench', class: 'i-lucide-wrench' },
	{ name: 'megaphone', class: 'i-lucide-megaphone' },
	{ name: 'beaker', class: 'i-lucide-flask-conical' },
];
