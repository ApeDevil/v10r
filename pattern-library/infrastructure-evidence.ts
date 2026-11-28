/**
 * Infrastructure evidence: which needs the code behind a pattern record demonstrably uses.
 *
 * Reads the files a record's `code` refs point at (tests excluded) and maps their DIRECT imports of
 * infrastructure adapters to needs. `validate.ts` requires every need found here to be declared on
 * the record at some level — required, conditional, optional or implementation — so a record can no
 * longer say "no infrastructure" while its code opens a database connection.
 *
 * Direct imports only, on purpose: following barrels transitively attributes every need of a whole
 * domain to anything that imports one function from it, which would force false declarations.
 * What a pattern inherits from the patterns it builds on is the job of the relationship graph.
 * `scheduler`, `external-api` and `container-host` have no reliable import signal and stay curated.
 *
 * Bun/Node only (filesystem). Deterministic: same tree, same answer.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { InfrastructureNeed, PatternRecord } from './schema.ts';

/** Module paths (repo-relative, prefix match) and packages (`pkg:` prefix match) that ARE an adapter. */
const ADAPTER_MODULES: ReadonlyArray<{
	need: InfrastructureNeed;
	modules: readonly string[];
	except?: readonly string[];
}> = [
	{
		need: 'relational-db',
		modules: ['src/lib/server/db', 'pkg:drizzle-orm', 'pkg:@neondatabase/serverless'],
		// Pure functions that live beside the database layer but open no connection.
		except: ['src/lib/server/db/content-hash', 'src/lib/server/db/id'],
	},
	{ need: 'vector-search', modules: ['src/lib/server/db/schema/retrieval/_custom-types'] },
	{ need: 'graph-db', modules: ['src/lib/server/graph'] },
	{
		need: 'key-value-store',
		// The cache domain's tiers read and write Redis; its error and type modules do not.
		modules: ['src/lib/server/cache', 'pkg:@upstash/redis', 'pkg:@upstash/ratelimit'],
		except: ['src/lib/server/cache/errors', 'src/lib/server/cache/types'],
	},
	{ need: 'object-storage', modules: ['src/lib/server/store', 'pkg:@aws-sdk/client-s3'] },
	{ need: 'llm-provider', modules: ['src/lib/server/ai/providers', 'pkg:ai', 'pkg:@ai-sdk/'] },
	{
		need: 'email-delivery',
		modules: ['src/lib/server/auth/send-auth-email', 'src/lib/server/notifications/channels/email'],
	},
	{ need: 'wasm-toolchain', modules: ['src/lib/wasm'] },
];

/** Source-text signals for capabilities that are used through a platform API rather than an import. */
const ADAPTER_TEXT: ReadonlyArray<{ need: InfrastructureNeed; pattern: RegExp }> = [
	{ need: 'web-worker', pattern: /new Worker\(|\?worker['"]/ },
	{ need: 'service-worker', pattern: /navigator\.serviceWorker/ },
	{ need: 'vector-search', pattern: /cosineDistance\(/ },
	{ need: 'email-delivery', pattern: /api\.resend\.com/ },
];

/**
 * Code refs that survey a whole layer instead of implementing the record's pattern. Scanning them
 * would attribute the layer's infrastructure to the pattern. Each entry says why it is exempt.
 */
export const SURVEY_REFS: ReadonlyArray<{ pattern: string; path: string; why: string }> = [
	{
		pattern: 'multi-client-core',
		path: 'src/lib/server',
		why: 'the whole server layer, cited to show where domains live; the architectural style needs no infrastructure',
	},
	{ pattern: 'architecture-codebase-map', path: 'src', why: 'a map of the source tree, not an implementation' },
	{
		pattern: 'architecture-rest-api',
		path: 'src/routes/api',
		why: 'every endpoint of the app, cited as examples of the envelope; each endpoint belongs to its own pattern',
	},
	{
		pattern: 'architecture-runtime-layers',
		path: 'src/hooks.server.ts',
		why: 'the request pipeline is cited to show the layers; each layer is its own pattern',
	},
	{
		pattern: 'architecture-middleware',
		path: 'src/hooks.server.ts',
		why: 'the pipeline composes handles from many domains; each handle belongs to its own pattern',
	},
];

const SOURCE_FILE = /\.(ts|js|svelte)$/;
const TEST_FILE = /\.(test|spec)\.ts$|\.gate\.test\.ts$|\.pglite\.test\.ts$/;
const EXTENSIONS = ['', '.ts', '.js', '.svelte', '/index.ts', '/index.js'];
// Value imports and re-exports, static and dynamic. `import type` / `export type` carry no runtime need.
const IMPORT =
	/(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** `src/lib/server/db` matches itself, `src/lib/server/db/…` and `src/lib/server/db.ts`, never `…/dbops`. */
function isModule(resolved: string, module: string): boolean {
	if (module.endsWith('/')) return resolved.startsWith(module);
	return resolved === module || resolved.startsWith(`${module}/`) || resolved.startsWith(`${module}.`);
}

/** Comments mention APIs without using them; text signals look at code only. */
function withoutComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('//'))
		.join('\n');
}

function resolveSpecifier(root: string, specifier: string, fromFile: string): string {
	let base: string;
	if (specifier.startsWith('#lib/') || specifier.startsWith('$lib/')) base = join(root, 'src/lib', specifier.slice(5));
	else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
	else return `pkg:${specifier}`;
	base = base.replace(/\?.*$/, '');
	for (const extension of EXTENSIONS) {
		const candidate = base + extension;
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate.slice(root.length + 1);
	}
	return base.slice(root.length + 1);
}

function sourceFiles(root: string, path: string): string[] {
	const target = join(root, path.split('#')[0]);
	if (!existsSync(target)) return [];
	if (statSync(target).isFile()) return SOURCE_FILE.test(target) && !TEST_FILE.test(target) ? [target] : [];
	return readdirSync(target, { recursive: true })
		.map((entry) => join(target, String(entry)))
		.filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file) && statSync(file).isFile())
		.sort();
}

/** One need the scan found, with the first file and the import or signal that shows it. */
export interface NeedEvidence {
	need: InfrastructureNeed;
	file: string;
	signal: string;
}

function evidenceInFile(root: string, file: string): NeedEvidence[] {
	const text = readFileSync(file, 'utf8');
	const relative = file.slice(root.length + 1);
	const found: NeedEvidence[] = [];
	for (const match of text.matchAll(IMPORT)) {
		const specifier = match[1] ?? match[2];
		if (!specifier) continue;
		const resolved = resolveSpecifier(root, specifier, file);
		for (const { need, modules, except = [] } of ADAPTER_MODULES) {
			if (except.some((module) => isModule(resolved, module))) continue;
			if (modules.some((module) => isModule(resolved, module))) found.push({ need, file: relative, signal: specifier });
		}
	}
	const code = withoutComments(text);
	for (const { need, pattern } of ADAPTER_TEXT) {
		const hit = code.match(pattern);
		if (hit) found.push({ need, file: relative, signal: hit[0] });
	}
	return found;
}

/** Needs the record's code demonstrably uses — one evidence entry per need, first file in path order. */
export function scanInfrastructureEvidence(root: string, pattern: PatternRecord): NeedEvidence[] {
	const exempt = new Set(SURVEY_REFS.filter((entry) => entry.pattern === pattern.id).map((entry) => entry.path));
	const byNeed = new Map<InfrastructureNeed, NeedEvidence>();
	for (const ref of pattern.code) {
		const kind = ref.kind ?? 'file';
		if ((kind !== 'file' && kind !== 'dir') || exempt.has(ref.path)) continue;
		for (const file of sourceFiles(root, ref.path)) {
			for (const evidence of evidenceInFile(root, file))
				if (!byNeed.has(evidence.need)) byNeed.set(evidence.need, evidence);
		}
	}
	return [...byNeed.values()];
}
