import { cypher } from '../index';
import { ensureConstraints } from './constraints';

/**
 * Clear all data and re-seed the Tech Stack Knowledge Graph.
 *
 * This is idempotent — safe to call repeatedly.
 */
export async function reseedGraph(): Promise<void> {
	// 1. Clear all existing data
	await cypher('MATCH (n) WHERE n:Layer OR n:Technology OR n:Concept OR n:Showcase DETACH DELETE n');

	// 2. Ensure constraints + indexes exist
	await ensureConstraints();

	// 3. Create all nodes and relationships in a single statement
	await cypher(`
		// ─── Layers ─────────────────────────────────────────────
		CREATE (lRuntime:Layer {name: 'Runtime', description: 'JavaScript/TypeScript execution environment', order: 1})
		CREATE (lFramework:Layer {name: 'Framework', description: 'Application framework and component model', order: 2})
		CREATE (lDatabase:Layer {name: 'Database', description: 'Data persistence and querying', order: 3})
		CREATE (lOrm:Layer {name: 'ORM', description: 'Object-relational mapping and query building', order: 4})
		CREATE (lAuth:Layer {name: 'Auth', description: 'Authentication and session management', order: 5})
		CREATE (lStyling:Layer {name: 'Styling', description: 'CSS framework and component library', order: 6})
		CREATE (lQuality:Layer {name: 'Quality', description: 'Code linting and formatting', order: 7})
		CREATE (lHosting:Layer {name: 'Hosting', description: 'Deployment and edge functions', order: 8})
		CREATE (lI18n:Layer {name: 'i18n', description: 'Internationalization and localization', order: 9})
		CREATE (l3d:Layer {name: '3D', description: 'Three-dimensional rendering and physics', order: 10})

		// ─── Technologies ───────────────────────────────────────
		CREATE (tBun:Technology {name: 'Bun', version: '1.x', description: 'All-in-one JavaScript runtime, bundler, and package manager', url: 'https://bun.sh', category: 'runtime'})
		CREATE (tSvelteKit:Technology {name: 'SvelteKit', version: '2', description: 'Full-stack web framework with SSR, routing, and form actions', url: 'https://svelte.dev/docs/kit', category: 'framework'})
		CREATE (tSvelte:Technology {name: 'Svelte', version: '5', description: 'Reactive UI compiler with runes-based state management', url: 'https://svelte.dev', category: 'framework'})
		CREATE (tPostgres:Technology {name: 'PostgreSQL', version: '16', description: 'Advanced relational database via Neon serverless', url: 'https://neon.tech', category: 'database'})
		CREATE (tNeo4j:Technology {name: 'Neo4j', version: '5', description: 'Native graph database via Aura cloud', url: 'https://neo4j.com', category: 'database'})
		CREATE (tDrizzle:Technology {name: 'Drizzle', version: '0.x', description: 'TypeScript-first ORM with zero overhead', url: 'https://orm.drizzle.team', category: 'orm'})
		CREATE (tUno:Technology {name: 'UnoCSS', version: '0.x', description: 'Instant on-demand atomic CSS engine', url: 'https://unocss.dev', category: 'styling'})
		CREATE (tBits:Technology {name: 'Bits UI', version: '1.x', description: 'Headless accessible UI components for Svelte', url: 'https://bits-ui.com', category: 'ui'})
		CREATE (tBetterAuth:Technology {name: 'Better Auth', version: '1.x', description: 'Session-based authentication library', url: 'https://better-auth.com', category: 'auth'})
		CREATE (tValibot:Technology {name: 'Valibot', version: '1.x', description: 'Modular schema validation with tree-shaking', url: 'https://valibot.dev', category: 'validation'})
		CREATE (tSuperforms:Technology {name: 'Superforms', version: '2.x', description: 'SvelteKit form handling with progressive enhancement', url: 'https://superforms.rocks', category: 'forms'})
		CREATE (tBiome:Technology {name: 'Biome', version: '1.x', description: 'Fast linter and formatter replacing ESLint + Prettier', url: 'https://biomejs.dev', category: 'quality'})
		CREATE (tVercel:Technology {name: 'Vercel', description: 'Edge-optimized hosting with serverless functions', url: 'https://vercel.com', category: 'hosting'})
		CREATE (tParaglide:Technology {name: 'Paraglide', version: '2.x', description: 'Fully type-safe i18n with zero runtime overhead', url: 'https://inlang.com/m/gerre34r/library-inlang-paraglideJs', category: 'i18n'})
		CREATE (tThreejs:Technology {name: 'Three.js', description: 'JavaScript 3D rendering library', url: 'https://threejs.org', category: '3d'})
		CREATE (tThrelte:Technology {name: 'Threlte', version: '8', description: 'Svelte wrapper for Three.js with declarative scenes', url: 'https://threlte.xyz', category: '3d'})
		CREATE (tPodman:Technology {name: 'Podman', description: 'Rootless container engine for dev environments', url: 'https://podman.io', category: 'containers'})
		CREATE (tNeon:Technology {name: 'Neon', description: 'Serverless PostgreSQL with scale-to-zero', url: 'https://neon.tech', category: 'database'})

		// ─── Concepts ───────────────────────────────────────────
		CREATE (cSsr:Concept {name: 'SSR', description: 'Server-side rendering for initial page loads'})
		CREATE (cReactivity:Concept {name: 'Reactivity', description: 'Automatic UI updates when state changes'})
		CREATE (cTypeSafety:Concept {name: 'Type Safety', description: 'Compile-time type checking across the stack'})
		CREATE (cAtomicCss:Concept {name: 'Atomic CSS', description: 'Utility-first CSS with single-purpose classes'})
		CREATE (cGraphTraversal:Concept {name: 'Graph Traversal', description: 'Walking relationships between connected entities'})
		CREATE (cSessionAuth:Concept {name: 'Session Auth', description: 'Server-side session-based authentication'})
		CREATE (cValidation:Concept {name: 'Validation', description: 'Input validation with schema definitions'})
		CREATE (cContainerization:Concept {name: 'Containerization', description: 'Isolated reproducible development environments'})

		// ─── Showcases ──────────────────────────────────────────
		CREATE (sDb:Showcase {name: 'Database', path: '/showcases/db', description: 'PostgreSQL + Neo4j data storage demos'})
		CREATE (sUi:Showcase {name: 'UI', path: '/showcases/ui', description: 'Component library and styling demos'})
		CREATE (sForms:Showcase {name: 'Forms', path: '/showcases/forms', description: 'Validation and form handling demos'})

		// ─── BELONGS_TO relationships ───────────────────────────
		CREATE (tBun)-[:BELONGS_TO]->(lRuntime)
		CREATE (tSvelteKit)-[:BELONGS_TO]->(lFramework)
		CREATE (tSvelte)-[:BELONGS_TO]->(lFramework)
		CREATE (tPostgres)-[:BELONGS_TO]->(lDatabase)
		CREATE (tNeo4j)-[:BELONGS_TO]->(lDatabase)
		CREATE (tNeon)-[:BELONGS_TO]->(lDatabase)
		CREATE (tDrizzle)-[:BELONGS_TO]->(lOrm)
		CREATE (tBetterAuth)-[:BELONGS_TO]->(lAuth)
		CREATE (tUno)-[:BELONGS_TO]->(lStyling)
		CREATE (tBits)-[:BELONGS_TO]->(lStyling)
		CREATE (tBiome)-[:BELONGS_TO]->(lQuality)
		CREATE (tVercel)-[:BELONGS_TO]->(lHosting)
		CREATE (tParaglide)-[:BELONGS_TO]->(lI18n)
		CREATE (tThreejs)-[:BELONGS_TO]->(l3d)
		CREATE (tThrelte)-[:BELONGS_TO]->(l3d)
		CREATE (tPodman)-[:BELONGS_TO]->(lRuntime)
		CREATE (tValibot)-[:BELONGS_TO]->(lQuality)
		CREATE (tSuperforms)-[:BELONGS_TO]->(lFramework)

		// ─── DEPENDS_ON relationships ───────────────────────────
		CREATE (tSvelteKit)-[:DEPENDS_ON {reason: 'SvelteKit compiles Svelte components'}]->(tSvelte)
		CREATE (tSvelteKit)-[:DEPENDS_ON {reason: 'SvelteKit runs on Bun runtime'}]->(tBun)
		CREATE (tDrizzle)-[:DEPENDS_ON {reason: 'Drizzle queries PostgreSQL'}]->(tPostgres)
		CREATE (tThrelte)-[:DEPENDS_ON {reason: 'Threlte wraps Three.js for Svelte'}]->(tThreejs)
		CREATE (tThrelte)-[:DEPENDS_ON {reason: 'Threlte uses Svelte components'}]->(tSvelte)
		CREATE (tSuperforms)-[:DEPENDS_ON {reason: 'Superforms integrates with SvelteKit forms'}]->(tSvelteKit)
		CREATE (tSuperforms)-[:DEPENDS_ON {reason: 'Superforms uses Valibot for validation'}]->(tValibot)
		CREATE (tBetterAuth)-[:DEPENDS_ON {reason: 'Better Auth stores sessions in PostgreSQL'}]->(tPostgres)
		CREATE (tBits)-[:DEPENDS_ON {reason: 'Bits UI components are Svelte components'}]->(tSvelte)
		CREATE (tParaglide)-[:DEPENDS_ON {reason: 'Paraglide integrates with SvelteKit routing'}]->(tSvelteKit)
		CREATE (tNeon)-[:DEPENDS_ON {reason: 'Neon hosts PostgreSQL databases'}]->(tPostgres)
		CREATE (tUno)-[:DEPENDS_ON {reason: 'UnoCSS processes Svelte template classes'}]->(tSvelte)

		// ─── IMPLEMENTS relationships ───────────────────────────
		CREATE (tSvelteKit)-[:IMPLEMENTS]->(cSsr)
		CREATE (tSvelte)-[:IMPLEMENTS]->(cReactivity)
		CREATE (tDrizzle)-[:IMPLEMENTS]->(cTypeSafety)
		CREATE (tUno)-[:IMPLEMENTS]->(cAtomicCss)
		CREATE (tNeo4j)-[:IMPLEMENTS]->(cGraphTraversal)
		CREATE (tBetterAuth)-[:IMPLEMENTS]->(cSessionAuth)
		CREATE (tValibot)-[:IMPLEMENTS]->(cValidation)
		CREATE (tSuperforms)-[:IMPLEMENTS]->(cValidation)
		CREATE (tPodman)-[:IMPLEMENTS]->(cContainerization)
		CREATE (tBun)-[:IMPLEMENTS]->(cTypeSafety)

		// ─── INTEGRATES_WITH relationships ──────────────────────
		CREATE (tDrizzle)-[:INTEGRATES_WITH {how: 'Schema-driven migrations and queries'}]->(tSvelteKit)
		CREATE (tBetterAuth)-[:INTEGRATES_WITH {how: 'Auth hooks in hooks.server.ts'}]->(tSvelteKit)
		CREATE (tUno)-[:INTEGRATES_WITH {how: 'Vite plugin for class extraction'}]->(tSvelteKit)
		CREATE (tBiome)-[:INTEGRATES_WITH {how: 'Pre-commit hooks and CI checks'}]->(tSvelteKit)
		CREATE (tParaglide)-[:INTEGRATES_WITH {how: 'Reroute hook for locale routing'}]->(tSvelteKit)
		CREATE (tBits)-[:INTEGRATES_WITH {how: 'Styled with UnoCSS utilities'}]->(tUno)

		// ─── DEMONSTRATES relationships ─────────────────────────
		CREATE (sDb)-[:DEMONSTRATES]->(tPostgres)
		CREATE (sDb)-[:DEMONSTRATES]->(tNeo4j)
		CREATE (sDb)-[:DEMONSTRATES]->(tDrizzle)
		CREATE (sUi)-[:DEMONSTRATES]->(tBits)
		CREATE (sForms)-[:DEMONSTRATES]->(tSuperforms)

		// ─── REQUIRES relationships ─────────────────────────────
		CREATE (cSsr)-[:REQUIRES]->(cReactivity)
		CREATE (cGraphTraversal)-[:REQUIRES]->(cTypeSafety)
		CREATE (cSessionAuth)-[:REQUIRES]->(cValidation)
	`);
}
