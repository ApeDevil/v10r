/**
 * NAMING GATE.
 *
 * `docs/naming.md` is the vocabulary; this file is what stops it from becoming a wish. Each
 * entry below is a term the codebase used to carry for a concept it no longer names — the
 * residue of a rename that reached the schema or the route but not the rest of the tree.
 * A reintroduction fails here, naming the replacement, rather than surviving review because
 * the old word still looked plausible in its neighbourhood.
 *
 * Scope is deliberately narrow. This gate owns RETIRED terms, not style: it cannot tell you
 * whether a new name is good, only that an old one came back. Words the repo keeps on
 * purpose — `lane` for the analytics two-lane model, `provider` for AI vendors, `RAG` as the
 * industry term in external-facing tool copy — are listed as exemptions with their reason,
 * so the exemption list reads as the argument for keeping them.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

interface RetiredTerm {
	/** The term as it would reappear. Matched case-sensitively, on word boundaries. */
	term: string;
	/** What to use instead — printed in the failure so the fix needs no lookup. */
	use: string;
	/** Files allowed to keep it, repo-relative. Each needs a reason in `why`. */
	allow?: string[];
	/** Why those files are exempt. Required whenever `allow` is non-empty. */
	why?: string;
}

const RETIRED: RetiredTerm[] = [
	{
		term: 'rag-shared',
		use: 'retrieval-shared',
		allow: ['docs/naming.md'],
		why: 'the vocabulary doc quotes retired terms by definition',
	},
	{
		term: 'nRAG',
		use: 'retrieval',
		allow: ['docs/naming.md', 'docs/Ref-ToDo.md', 'docs/blueprint/ai/knowledge-base.md'],
		why: 'naming.md quotes it; Ref-ToDo records the Neo4j label rename; knowledge-base.md is the retirement record',
	},
	{
		term: 'RetrieverLane',
		use: 'RetrieverId',
		allow: ['docs/naming.md', 'docs/blueprint/ai/retrieval-observability.md'],
		why: 'naming.md quotes retired terms; the observability doc carries a dated rename note',
	},
	{ term: 'TelemetryLane', use: 'TelemetryOrigin', allow: ['docs/naming.md'], why: 'quoted as retired' },
	{ term: 'ProbeLane', use: 'ProbeCorpus', allow: ['docs/naming.md'], why: 'quoted as retired' },
	{
		term: 'RetrievalLayer',
		use: 'RetrievalCorpus',
		allow: ['docs/naming.md', 'docs/blueprint/ai/retrieval-observability.md'],
		why: 'naming.md quotes retired terms; the observability doc carries a dated rename note',
	},
	{
		term: 'PIPELINE_REGISTRY',
		use: 'RETRIEVAL_STEPS',
		allow: ['docs/blueprint/ai/retrieval-observability.md', 'docs/blueprint/ai/README.md'],
		why: 'design records quoting the pre-rename contract; both carry the new name beside it',
	},
	{ term: 'NotificationProvider', use: 'DeliveryChannel', allow: ['docs/naming.md'], why: 'quoted as retired' },
	{
		term: 'NotificationService',
		use: 'sendNotification',
		allow: ['docs/naming.md', 'docs/blueprint/architecture/multi-client-core.md'],
		why: 'naming.md quotes retired terms; multi-client-core.md keeps `INotificationService` as a named anti-pattern',
	},
	{
		term: 'workbench',
		use: 'dock',
		allow: ['docs/naming.md', 'docs/Ref-ToDo.md'],
		why: 'naming.md quotes retired terms; Ref-ToDo explains why the Neo4j projection must be re-run',
	},
];

/**
 * Exported type names allowed to be declared in more than one file, with the reason. Every
 * other duplicate is the failure mode this audit found repeatedly: a second declaration of a
 * shape that already exists, which then drifts from the original in silence.
 */
const DUPLICATE_DECLARATIONS_ALLOWED: Record<string, string> = {
	// `db/index.ts` re-derives it from the live client so CLI consumers can type a handle
	// without importing `$env/dynamic/private`. Both files say so.
	Database: 'deliberate re-derivation, commented in both files',
	// Per-domain outcome shapes with different fields, following the `<Concept>Result`
	// convention. Documents vs images ingest nothing alike.
	IngestResult: 'per-domain result shape, distinct fields',
	// The stdio MCP server runs under bare Bun with no `$lib` alias and no bundler, so it
	// cannot import the hosted transport's types. `mcp/patterns/parity.test.ts` is what keeps
	// the two copies honest; collapsing them would break the container instead.
	ToolDef: 'stdio MCP cannot import $lib — guarded by patterns/parity.test.ts',
	ToolResult: 'stdio MCP cannot import $lib — guarded by patterns/parity.test.ts',
};

const EXPORTED_TYPE = /^export (?:type|interface|class|enum) ([A-Z][A-Za-z0-9_]*)\b/gm;

/**
 * Exported functions and constants allowed to share a name, with the reason. Unlike the type
 * list above, most entries here are deliberate PARALLELISM rather than accident: the same
 * word applied to the same operation across sibling modules is what makes the set readable.
 * An entry earns its place by naming why the repetition is the point.
 */
const DUPLICATE_VALUES_ALLOWED: Record<string, string> = {
	// Policy belongs to its domain: every `server/[domain]/config.ts` names its own window,
	// ceiling and key prefix. Sharing the names across domains is the pattern that replaced
	// the god-constants module; collapsing them would re-introduce it.
	RATE_LIMIT_MAX: 'per-domain policy in [domain]/config.ts',
	RATE_LIMIT_WINDOW: 'per-domain policy in [domain]/config.ts',
	RATE_LIMIT_PREFIX: 'per-domain policy in [domain]/config.ts',
	WRITE_RATE_LIMIT_MAX: 'per-domain policy — http/ is the default, blog/ overrides it',
	WRITE_RATE_LIMIT_WINDOW: 'per-domain policy — http/ is the default, blog/ overrides it',
	MAX_UPLOAD_SIZE: 'per-domain policy — 2 MB for R2 objects, 8 MB for images',
	// Three showcase backends demonstrating one operation. The shared verb is what lets a
	// reader move between /showcases/db/{graph,storage,cache}/connection without relearning.
	verifyConnection: 'one operation, three backend showcases — the parallel vocabulary is the point',
	// Each marks ITS OWN entity terminal. They never meet in one module.
	markFailed: 'per-domain terminal transition, on unrelated entities',
	// The stdio server runs under bare Bun with no `$lib` alias and no bundler, so it cannot
	// import the hosted implementations. `mcp/patterns/parity.test.ts` keeps the copies honest.
	tokenizePatternQuery: 'stdio MCP cannot import $lib — guarded by patterns/parity.test.ts',
	scorePatterns: 'stdio MCP cannot import $lib — guarded by patterns/parity.test.ts',
	NEXT_ACTIONS_HEADING: 'stdio MCP cannot import $lib — guarded by patterns/parity.test.ts',
	MAX_LINES: 'stdio MCP cannot import $lib — guarded by patterns/parity.test.ts',
	DEFAULT_LINES: 'stdio MCP cannot import $lib — guarded by patterns/parity.test.ts',
};

const EXPORTED_VALUE = /^export (?:async function|function|const) ([A-Za-z_][A-Za-z0-9_]*)\b/gm;

/**
 * Acronyms the repo writes as words inside a mixed-case name: `AiError`, not `AIError`.
 * The convention was already the majority (`AiSurface`, `AiLayerId`, `McpCallLog`,
 * `RetrieverId`) but `AIError` sat one import away from `SimulateAiError`, which is how a
 * reader learns there are two spellings and guesses wrong. SCREAMING_SNAKE constants are a
 * different casing system — `AI_PAGE_SIZE` is untouched.
 */
const WORD_CASED_ACRONYMS = ['AI', 'RAG', 'MCP', 'API', 'URL', 'URI', 'HTTP', 'JSON', 'SQL', 'CSS', 'HTML', 'SSE'];

/** `rag` is retired vocabulary, so it is not merely mis-cased — it must not appear at all. */
const RETIRED_ACRONYMS = ['RAG', 'Rag'];

/** Split an identifier into camelCase / snake_case segments: `getAllRagEntities` → All, Rag, Entities. */
function nameSegments(name: string): string[] {
	return name.split('_').flatMap((part) => part.match(/[A-Z]+(?![a-z])|[A-Z][a-z0-9]*|[a-z0-9]+/g) ?? []);
}

function isScreamingSnake(name: string): boolean {
	return !/[a-z]/.test(name);
}

function declaredNames(source: string): string[] {
	return [
		...[...source.matchAll(EXPORTED_TYPE)].map((match) => match[1]),
		...[...source.matchAll(EXPORTED_VALUE)].map((match) => match[1]),
	];
}

/**
 * i18n key namespaces. The key space is flat and global, so an unprefixed key is a name
 * squatting on a common English word: `greeting`, `sample_text` and `section_formatting`
 * belonged to /showcases/i18n and would have silently answered for any later page that
 * reached for the same word.
 */
const I18N_AREAS = [
	'account',
	'admin',
	'ai',
	'auth',
	'blog',
	'composites',
	'consent',
	'credits',
	'docs',
	'errors',
	'feedback',
	'footer',
	'home',
	'nav',
	'notif',
	'pair',
	'perf',
	'primitives',
	'programming',
	'pwa',
	'session',
	'shell',
	'showcase',
];

/**
 * Files whose export names SvelteKit chooses, not us: routes (`load`, `GET`, `actions`), the
 * hooks (`handle`, `handleError` — the same name on the server and the client by contract) and
 * param matchers (`match`). Plus wasm-bindgen's generated glue, which is nobody's vocabulary.
 */
function isFrameworkContract(file: string): boolean {
	return (
		file.startsWith('src/routes/') ||
		file.startsWith('src/params/') ||
		file.startsWith('src/hooks.') ||
		file.startsWith('src/lib/wasm/kernel/') ||
		file.startsWith('scripts/')
	);
}

/**
 * Filenames that name a bucket instead of a responsibility. Each one this audit found was
 * holding unrelated things precisely because the name permitted it — `admin/helpers.ts` had
 * audit context and an analytics range parser in it, and `notifications/service.ts` was a
 * single-method object around what is now `sendNotification`.
 *
 * The directory `$lib/utils/` is deliberately NOT covered: it is a shelf of small, sharply
 * named leaves (`cn.ts`, `safe-path.ts`, `xml.ts`), and the file names carry the meaning.
 */
const GENERIC_FILENAMES = [
	'utils.ts',
	'helpers.ts',
	'misc.ts',
	'common.ts',
	'core.ts',
	'data.ts',
	'manager.ts',
	'service.ts',
	'handler.ts',
	'shared.ts',
	'constants.ts',
	'stuff.ts',
];

/** `<Name>DTO` types: the repo says `Public<Name>` for a sanitized client-facing shape. */
const DTO_SUFFIX = /\b[A-Z][A-Za-z0-9]*DTO\b/;

/** i18n key prefixes retired with the route areas that used to justify them. */
const RETIRED_KEY_PREFIXES: Array<{ prefix: string; use: string }> = [{ prefix: 'app_', use: 'account_' }];
// `notif_*` is NOT listed. Those key names are stored data: `notifications.message_key`
// holds them and `renderNotification` resolves the row's value against the Paraglide
// registry at send time, so renaming the keys would blank every notification already in
// the table. The abbreviation stays until a data migration is worth its own decision.

const SCANNED_ROOTS = ['src', 'scripts', 'mcp', 'docs'];
const SCANNED_EXTENSIONS = ['.ts', '.svelte', '.md'];

function sourceFiles(): string[] {
	const out: string[] = [];
	const visit = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const absolute = join(dir, entry);
			const file = relative(ROOT, absolute).split('\\').join('/');
			// Generated: Paraglide is recompiled from messages/, docs/pattern-library/ from the
			// registry. Both mirror their source, so gating them would report the same drift twice.
			if (entry === 'paraglide' || file === 'docs/pattern-library') continue;
			if (entry === 'node_modules' || entry.startsWith('.')) continue;
			if (statSync(absolute).isDirectory()) {
				visit(absolute);
			} else if (SCANNED_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
				// This file names every retired term on purpose.
				if (entry !== 'naming.gate.test.ts') out.push(file);
			}
		}
	};
	for (const root of SCANNED_ROOTS) visit(join(ROOT, root));
	return out.sort();
}

const FILES = sourceFiles();
/** Declaration-shaped checks read code only: a doc's example block is not a declaration. */
const CODE_FILES = FILES.filter((file) => !file.endsWith('.md'));

describe('naming gate', () => {
	// Sentinel: a broken glob would make every assertion below vacuously pass.
	it('reads the source tree', () => {
		expect(FILES.length).toBeGreaterThan(1000);
	});

	for (const { term, use, allow = [] } of RETIRED) {
		it(`does not reintroduce "${term}" (use ${use})`, () => {
			const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
			const offenders = FILES.filter(
				(file) => !allow.includes(file) && pattern.test(readFileSync(join(ROOT, file), 'utf8')),
			);
			expect(offenders, `${term} → ${use}`).toEqual([]);
		});
	}

	it('every allowance names files that still exist', () => {
		const stale: string[] = [];
		for (const { term, allow = [] } of RETIRED) {
			for (const file of allow) {
				try {
					readFileSync(join(ROOT, file), 'utf8');
				} catch {
					stale.push(`${term}: ${file}`);
				}
			}
		}
		expect(stale, 'drop allowances for files that are gone').toEqual([]);
	});

	it('every allowance carries a reason', () => {
		const unexplained = RETIRED.filter((r) => (r.allow?.length ?? 0) > 0 && !r.why).map((r) => r.term);
		expect(unexplained).toEqual([]);
	});

	/**
	 * The check that found most of what this refactor fixed: `Session`, `feedbackSchema`,
	 * `Registry`, `ChatMessage`, `CycleInput`, `MetadataFieldKey` were all a second
	 * declaration of an existing shape rather than an import of it.
	 */
	it('declares each exported type name in exactly one file', () => {
		const where = new Map<string, string[]>();
		for (const file of CODE_FILES) {
			if (file.endsWith('.test.ts')) continue;
			const source = readFileSync(join(ROOT, file), 'utf8');
			for (const match of source.matchAll(EXPORTED_TYPE)) {
				const name = match[1];
				if (name in DUPLICATE_DECLARATIONS_ALLOWED) continue;
				where.set(name, [...(where.get(name) ?? []), file]);
			}
		}
		const duplicated = [...where]
			.filter(([, files]) => files.length > 1)
			.map(([name, files]) => `${name}: ${files.join(', ')}`);
		expect(duplicated, 'import the existing declaration instead of re-declaring it').toEqual([]);
	});

	it('every duplicate-declaration allowance is still duplicated', () => {
		const counts = new Map<string, number>();
		for (const file of CODE_FILES) {
			if (file.endsWith('.test.ts')) continue;
			for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(EXPORTED_TYPE)) {
				counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
			}
		}
		const stale = Object.keys(DUPLICATE_DECLARATIONS_ALLOWED).filter((name) => (counts.get(name) ?? 0) < 2);
		expect(stale, 'drop the allowance — the duplicate is gone').toEqual([]);
	});

	it('uses Public<Name>, not <Name>DTO, for client-facing projections', () => {
		const offenders = CODE_FILES.filter((file) => DTO_SUFFIX.test(readFileSync(join(ROOT, file), 'utf8')));
		expect(offenders).toEqual([]);
	});

	for (const { prefix, use } of RETIRED_KEY_PREFIXES) {
		it(`no i18n key starts with "${prefix}" (use ${use})`, () => {
			const messages = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8')) as Record<string, unknown>;
			const offenders = Object.keys(messages).filter((key) => key.startsWith(prefix));
			expect(offenders).toEqual([]);
		});
	}

	/**
	 * The member area is `account` everywhere: the route, the API group and the i18n prefix.
	 * `/api/me` was the last place still calling it something else.
	 */
	it('does not reintroduce /api/me', () => {
		const offenders = FILES.filter((file) => /\/api\/me\b/.test(readFileSync(join(ROOT, file), 'utf8')));
		expect(offenders).toEqual([]);
	});

	/**
	 * Same rule as the type check, for functions and constants. The second round of the audit
	 * found `iconSize` here — a design token map and a sidebar width calculation sharing one
	 * name — and `formatDate`, which had six implementations, three of them locale-blind in a
	 * trilingual app because nothing said the canonical one already existed.
	 */
	it('declares each exported function and constant in exactly one file', () => {
		const where = new Map<string, string[]>();
		for (const file of CODE_FILES) {
			if (file.endsWith('.test.ts') || file.endsWith('.d.ts')) continue;
			if (isFrameworkContract(file)) continue;
			for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(EXPORTED_VALUE)) {
				const name = match[1];
				if (name in DUPLICATE_VALUES_ALLOWED) continue;
				where.set(name, [...(where.get(name) ?? []), file]);
			}
		}
		const duplicated = [...where]
			.filter(([, files]) => files.length > 1)
			.map(([name, files]) => `${name}: ${files.join(', ')}`);
		expect(duplicated, 'import the existing export, or say what makes this one different').toEqual([]);
	});

	it('every duplicate-value allowance is still duplicated', () => {
		const counts = new Map<string, number>();
		for (const file of CODE_FILES) {
			if (file.endsWith('.test.ts') || file.endsWith('.d.ts')) continue;
			if (isFrameworkContract(file)) continue;
			for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(EXPORTED_VALUE)) {
				counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
			}
		}
		const stale = Object.keys(DUPLICATE_VALUES_ALLOWED).filter((name) => (counts.get(name) ?? 0) < 2);
		expect(stale, 'drop the allowance — the duplicate is gone').toEqual([]);
	});

	it('no file is named for a bucket instead of a responsibility', () => {
		const offenders = CODE_FILES.filter((file) => GENERIC_FILENAMES.some((generic) => file.endsWith(`/${generic}`)));
		expect(offenders, 'name the file for what it owns').toEqual([]);
	});

	it('spells an acronym as a word inside a mixed-case name', () => {
		const offenders: string[] = [];
		for (const file of CODE_FILES) {
			for (const name of declaredNames(readFileSync(join(ROOT, file), 'utf8'))) {
				if (isScreamingSnake(name)) continue;
				const shouting = nameSegments(name).filter((segment) => WORD_CASED_ACRONYMS.includes(segment));
				if (shouting.length > 0) offenders.push(`${name} (${file}) — write ${shouting.join(', ')} as a word`);
			}
		}
		expect(offenders, 'AiError, not AIError').toEqual([]);
	});

	it('names no declaration after the retired `rag` vocabulary', () => {
		const offenders: string[] = [];
		for (const file of CODE_FILES) {
			for (const name of declaredNames(readFileSync(join(ROOT, file), 'utf8'))) {
				if (nameSegments(name).some((segment) => RETIRED_ACRONYMS.includes(segment))) {
					offenders.push(`${name} (${file})`);
				}
			}
		}
		expect(offenders, 'the pipeline is `retrieval`').toEqual([]);
	});

	/** One Cloudflare account, one env var. The second name was read by exactly one module
	 *  and set by nobody, so its metrics path was unreachable. */
	it('reads the Cloudflare account id under one name', () => {
		const offenders = FILES.filter(
			// naming.md names retired terms by definition.
			(file) => file !== 'docs/naming.md' && readFileSync(join(ROOT, file), 'utf8').includes('CLOUDFLARE_ACCOUNT_ID'),
		);
		expect(offenders, 'use R2_ACCOUNT_ID').toEqual([]);
	});

	it('gives every i18n key a namespace', () => {
		const keys = Object.keys(JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8')) as object);
		const offenders = keys.filter((key) => !key.startsWith('$') && !I18N_AREAS.includes(key.split('_')[0]));
		expect(offenders, 'prefix the key with its area — the key space is flat and global').toEqual([]);
	});

	/** The package scripts are vocabulary too — `db:rag-*` outlived the schema it named. */
	it('no package script names a retired subsystem', () => {
		const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
		const offenders = Object.keys(pkg.scripts).filter(
			(name) => /\brag\b/.test(name) && name !== 'db:rename-rag-schema',
		);
		expect(offenders, 'db:rename-rag-schema keeps its name: it describes the migration it performs').toEqual([]);
	});
});

/** Guards the relative-path assumption the failure messages rely on. */
describe('naming gate paths', () => {
	it('reports repo-relative paths', () => {
		expect(FILES.every((file) => file === relative(ROOT, join(ROOT, file)))).toBe(true);
	});
});
