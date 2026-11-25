/**
 * Generative UI gate — the bundle and safety lines the pattern depends on, as facts about the
 * source tree:
 *
 * 1. No lit. `@a2ui/web_core`'s root is framework-free, but its basic catalog, `universal`
 *    and the `/v1_0` and `/v0_9` barrels register lit web components at module scope. One
 *    such import would ship a second component system and bypass `#lib/components`.
 * 2. web_core stays lazy. The lazy wrapper, the composite barrel and the client-safe contract
 *    barrel never reach it through static imports, so it lands only in the renderer's chunk.
 * 3. `@a2ui/agent` is server-only (the prompt generator, the Express compiler).
 * 4. No `{@html}` in the renderer: model text is never markup.
 * 5. One zod 3. web_core's own nested zod resolves to the app's `zod/v3`
 *    (`scripts/build/a2ui-zod-dedupe.ts`), the copy `zod-to-json-schema` already brings.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ZodType } from 'zod/v3';
import { loadGenerativeUiCatalog } from './load-catalog.ts';

const ROOT = resolve(__dirname, '../../..');
const AREAS = [
	'src/lib/generative-ui',
	'src/lib/components/composites/generative-surface',
	'src/lib/server/ai/generative-ui',
	'scripts/generative-ui',
];

function files(dir: string): string[] {
	const absolute = join(ROOT, dir);
	if (!existsSync(absolute)) return [];
	return readdirSync(absolute).flatMap((name) => {
		const path = join(dir, name);
		return statSync(join(ROOT, path)).isDirectory() ? files(path) : /\.(ts|svelte)$/.test(name) ? [path] : [];
	});
}

/** Static import specifiers (`import … from 'x'`, `export … from 'x'`, bare `import 'x'`) — not `import('x')`. */
function staticImports(source: string): string[] {
	return [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'"()]*?\sfrom\s+)?['"]([^'"]+)['"]/g)].map(
		(m) => m[1],
	);
}

const allImports = (source: string) =>
	[...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

const SOURCES = AREAS.flatMap(files);

const FORBIDDEN = [
	/^lit(\/|$)/,
	/^lit-html/,
	/^@lit\//,
	/^@lit-labs\//,
	/^@a2ui\/web_core\/universal/,
	/^@a2ui\/web_core\/catalogs\//,
	/^@a2ui\/web_core\/v0_9(\/|$)/,
	/^@a2ui\/web_core\/v1_0(\/|$)/,
	/^@a2ui\/(lit|react|angular)/,
	/\/catalogs\/basic/,
];

describe('generative UI gate', () => {
	it('scans the generative UI source (guards against a scan that matches nothing)', () => {
		expect(SOURCES.length).toBeGreaterThan(10);
	});

	it('never imports lit, the basic catalog, universal or a lit-registering barrel', () => {
		const offenders = SOURCES.flatMap((file) =>
			allImports(readFileSync(join(ROOT, file), 'utf8'))
				.filter((specifier) => FORBIDDEN.some((rule) => rule.test(specifier)))
				.map((specifier) => `${file} -> ${specifier}`),
		);
		expect(offenders).toEqual([]);
	});

	it('keeps @a2ui/agent on the server and in scripts', () => {
		const offenders = SOURCES.filter(
			(file) => !file.startsWith('src/lib/server/') && !file.startsWith('scripts/') && !file.endsWith('.test.ts'),
		).filter((file) => allImports(readFileSync(join(ROOT, file), 'utf8')).some((s) => s.startsWith('@a2ui/agent')));
		expect(offenders).toEqual([]);
	});

	it('keeps web_core out of the static import graph of the lazy entry points', () => {
		const entries = [
			'src/lib/components/composites/generative-surface/LazyGenerativeSurface.svelte',
			'src/lib/components/composites/generative-surface/index.ts',
			'src/lib/generative-ui/index.ts',
		];
		const reached = new Set<string>();
		const offenders: string[] = [];
		const walk = (file: string, trail: string[]) => {
			if (reached.has(file)) return;
			reached.add(file);
			const source = readFileSync(join(ROOT, file), 'utf8');
			// Type-only imports are erased and cannot pull a runtime.
			const runtime = staticImports(source.replace(/(?:^|\n)\s*(?:import|export)\s+type\s[^;]*;/g, ''));
			for (const specifier of runtime) {
				if (specifier.startsWith('@a2ui/')) offenders.push([...trail, file, specifier].join(' -> '));
				const target = specifier.startsWith('#lib/')
					? join('src/lib', specifier.slice('#lib/'.length))
					: specifier.startsWith('.')
						? relative(ROOT, resolve(ROOT, dirname(file), specifier))
						: null;
				if (target && AREAS.some((area) => target.startsWith(area)) && existsSync(join(ROOT, target))) {
					walk(target, [...trail, file]);
				}
			}
		};
		for (const entry of entries) walk(entry, []);
		expect(offenders).toEqual([]);
		expect(reached.size).toBeGreaterThan(3);
	});

	it('renders model text as text: no {@html} in the renderer', () => {
		const offenders = SOURCES.filter((file) => file.endsWith('.svelte')).filter((file) =>
			readFileSync(join(ROOT, file), 'utf8').includes('{@html'),
		);
		expect(offenders).toEqual([]);
	});

	it("builds the catalog schemas with the app's zod 3, not a second copy nested in web_core", () => {
		const schema = loadGenerativeUiCatalog().components.get('Text')?.schema;
		expect(schema).toBeInstanceOf(ZodType);
		expect(schema?.safeParse({ id: 't', component: 'Text', text: 'hi', onClick: 'x' }).success).toBe(false);
	});
});
