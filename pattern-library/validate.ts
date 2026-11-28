/**
 * Registry drift guard: structural schema, referential integrity, DAG check, and
 * filesystem existence for every referenced path. Exits non-zero on any error.
 *
 * Run (host):  podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/pattern-library/validate.ts
 * Run (container): bun run patterns:validate
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { headingAnchors } from '../src/lib/docs/heading-anchors.server.ts';
import { checkDecisionReferences, parseDecisionCatalog } from './architecture-engineering/decision-record.ts';
import decisionCatalogJson from './architecture-engineering/decisions.json';
import { EVIDENCE_LABS } from './architecture-engineering/evidence-labs.ts';
import { NODE_KINDS } from './architecture-engineering/vocabulary.ts';
import { scanInfrastructureEvidence } from './infrastructure-evidence.ts';
import { declaredNeeds } from './infrastructure-needs.ts';
import { loadRegistry } from './load.ts';
import { buildById, type RegRef, TITLE_NUMERALS_ALLOWED, volatileTitleFacts } from './schema.ts';

const ROOT = process.env.V10R_ROOT ?? resolve(import.meta.dir, '..');
const SHOWCASE_REGISTRY = 'src/lib/showcases/catalog/registry.ts';
// Route groups an approute may live under, tried in order. `(public)` covers
// showcase-adjacent pages, the bare locale dir covers /account, /admin,
// /pair, and src/routes covers locale-less endpoints like /api/*.
const APPROUTE_ROOTS = ['src/routes/[[locale=locale]]/(public)', 'src/routes/[[locale=locale]]', 'src/routes'];

const errors: string[] = [];
const warnings: string[] = [];

/**
 * `kind: 'route'` refs must be members of the showcase registry, not merely
 * directories on disk — an unregistered route is invisible to the catalog and
 * to docs resolution. The hrefs are scraped from the module SOURCE (the same
 * technique the drift tests use) because importing it would pull in generated
 * Paraglide output, which the documented ephemeral read-only-clone run of this
 * script does not have.
 */
function loadShowcaseHrefs(): Set<string> {
	const source = readFileSync(join(ROOT, SHOWCASE_REGISTRY), 'utf8');
	const hrefs = new Set<string>();
	for (const match of source.matchAll(/href: '(\/showcases[^']*)'/g)) {
		hrefs.add(match[1]);
	}
	return hrefs;
}

const showcaseHrefs = loadShowcaseHrefs();
const anchorsByFile = new Map<string, Set<string>>();

function checkRef(ref: RegRef, where: string): void {
	const kind = ref.kind ?? 'file';
	if (kind === 'route') {
		if (!showcaseHrefs.has(ref.path)) {
			errors.push(`${where}: route '${ref.path}' is not an href in ${SHOWCASE_REGISTRY}`);
		}
		return;
	}
	if (kind === 'approute') {
		if (!APPROUTE_ROOTS.some((root) => existsSync(join(ROOT, root, ref.path)))) {
			errors.push(`${where}: approute '${ref.path}' has no directory under any of: ${APPROUTE_ROOTS.join(', ')}`);
		}
		return;
	}
	const target = join(ROOT, ref.path.split('#')[0]);
	if (!existsSync(target)) {
		errors.push(`${where}: path '${ref.path}' does not exist`);
		return;
	}
	const stats = statSync(target);
	if (kind === 'file' && !stats.isFile()) {
		errors.push(`${where}: '${ref.path}' exists but is not a file (set kind: "dir"?)`);
	}
	// A `#fragment` must name a heading the page actually renders — the file existing is not
	// enough, and a renamed heading would otherwise leave a link that lands at the page top.
	const fragment = ref.path.includes('#') ? ref.path.slice(ref.path.indexOf('#') + 1) : null;
	if (fragment && stats.isFile() && target.endsWith('.md')) {
		const anchors = anchorsByFile.get(target) ?? headingAnchors(readFileSync(target, 'utf8'));
		anchorsByFile.set(target, anchors);
		if (!anchors.has(fragment)) {
			errors.push(`${where}: '${ref.path}' — no heading renders the anchor '#${fragment}'`);
		}
	}
	if (kind === 'dir' && !stats.isDirectory()) {
		errors.push(`${where}: '${ref.path}' exists but is not a directory`);
	}
}

const { registry, error } = loadRegistry();
if (!registry) {
	console.error(`FAIL structural: ${error}`);
	process.exit(1);
}

const byId = buildById(registry);

// Relationship integrity — targets, kinds, one relationship per pair, acyclic adoption — is a
// structural error in schema.ts, so loadRegistry above has already refused a broken graph.

for (const pattern of registry.patterns) {
	const lists: Array<[string, RegRef[]]> = [
		['docs', pattern.docs],
		['code', pattern.code],
		['tests', pattern.tests],
		['showcases', pattern.showcases],
	];
	for (const [field, refs] of lists) {
		refs.forEach((ref, index) => {
			checkRef(ref, `${pattern.id}.${field}[${index}]`);
		});
	}
	// Deep-tier depth (invariants/notes/capabilities/keywords/docs non-empty) and the
	// light-tier docs floor are structural errors in schema.ts. The only advisory
	// left: a light record with no keywords still loses search recall.
	if (pattern.tier === 'light' && pattern.keywords.length === 0) {
		warnings.push(`${pattern.id}: no keywords — search recall will be weak`);
	}
	// Maturity advisories. proven⇔refs+attestation is a structural error in
	// schema.ts; these two stay warnings by policy — staleness that fails the
	// gate teaches people to route around it (same stance as the perf snapshot).
	if (pattern.maturity === 'implemented' && pattern.tests.length + pattern.showcases.length > 0) {
		warnings.push(
			`${pattern.id}: has a tests/showcases ref but maturity is "implemented" — verify it and promote to "proven"`,
		);
	}
	if (pattern.maturity === 'proven' && pattern.verifiedAt) {
		const ageDays = Math.floor((Date.now() - Date.parse(pattern.verifiedAt)) / 86_400_000);
		if (Number.isNaN(ageDays) || ageDays > 180) {
			warnings.push(
				`${pattern.id}: verifiedAt ${pattern.verifiedAt} is ${Number.isNaN(ageDays) ? 'unparseable' : `${ageDays} days old`} — re-verify the proof surface`,
			);
		}
	}
}

// Needs evidence: every infrastructure adapter the record's code imports directly must be declared
// on the record at some level — required, conditional, optional or implementation. Declaring it
// "implementation" is honest (v10r's reference uses it, the pattern does not); omitting it is not.
for (const pattern of registry.patterns) {
	const declared = new Set(declaredNeeds(pattern).map((declaration) => declaration.need));
	for (const evidence of scanInfrastructureEvidence(ROOT, pattern)) {
		if (!declared.has(evidence.need)) {
			errors.push(
				`${pattern.id}.needs: its code uses ${evidence.need} (${evidence.file} imports '${evidence.signal}') — declare it at the level that is true (required, conditional, optional, or implementation with why), or exempt a survey ref in infrastructure-evidence.ts`,
			);
		}
	}
}

// Architecture Engineering node kinds speak the same need vocabulary: each need a node kind stands
// for must be declared by at least one of the patterns said to implement that kind.
for (const [kind, definition] of Object.entries(NODE_KINDS)) {
	const patterns = definition.patterns.map((id) => byId.get(id));
	for (const [index, pattern] of patterns.entries()) {
		if (!pattern)
			errors.push(`NODE_KINDS.${kind}.patterns[${index}]: '${definition.patterns[index]}' is not in the registry`);
	}
	for (const need of definition.needs) {
		const declaredBy = patterns.filter(
			(pattern) => pattern && declaredNeeds(pattern).some((entry) => entry.need === need),
		);
		if (declaredBy.length === 0) {
			errors.push(
				`NODE_KINDS.${kind}: needs ${need}, but none of its patterns (${definition.patterns.join(', ')}) declares it`,
			);
		}
	}
}

// Titles name the concept. Counts, versions and other volatile facts belong in the summary or are
// derived (D-09); the allow-list holds numerals that are part of a concept's name.
for (const pattern of registry.patterns) {
	for (const fact of volatileTitleFacts(pattern.title)) {
		errors.push(
			`${pattern.id}.title: '${fact}' in "${pattern.title}" is a volatile fact — name the concept, move the fact to the summary (allowed numerals: ${TITLE_NUMERALS_ALLOWED.join(', ')})`,
		);
	}
}

// The Architecture Engineering decision catalogue references patterns by id and evidence by
// path or route: every id must resolve (decision invariant 8) and every evidence ref must exist,
// with the same rules as a pattern's own refs. External `https://` evidence is not fetched.
const decisions = parseDecisionCatalog(decisionCatalogJson);
if (!decisions.catalog) {
	for (const message of decisions.errors) errors.push(`decisions.json: ${message}`);
} else {
	for (const message of checkDecisionReferences(decisions.catalog, registry)) errors.push(`decisions.json: ${message}`);
	for (const decision of decisions.catalog.decisions) {
		decision.evidence.forEach((entry, index) => {
			if (entry.ref.startsWith('https://')) return;
			const kind = entry.ref.startsWith('/showcases') ? 'route' : entry.ref.startsWith('/') ? 'approute' : 'file';
			checkRef({ path: entry.ref, kind }, `decisions.json ${decision.id}.evidence[${index}]`);
		});
	}
	const decisionIds = new Set(decisions.catalog.decisions.map((decision) => decision.id));
	for (const lab of EVIDENCE_LABS) {
		lab.refs.forEach((entry, index) => {
			const kind = entry.ref.startsWith('/showcases') ? 'route' : entry.ref.startsWith('/') ? 'approute' : 'file';
			checkRef({ path: entry.ref, kind }, `evidence-labs ${lab.id}.refs[${index}]`);
		});
		for (const id of lab.decisions)
			if (!decisionIds.has(id)) errors.push(`evidence-labs ${lab.id}: decision '${id}' does not exist`);
		for (const id of lab.patterns)
			if (!byId.has(id)) errors.push(`evidence-labs ${lab.id}: pattern '${id}' is not in the registry`);
	}
}

for (const warning of warnings) {
	console.error(`WARN ${warning}`);
}
if (errors.length > 0) {
	for (const message of errors) {
		console.error(`FAIL ${message}`);
	}
	console.error(`registry INVALID: ${errors.length} error(s), ${warnings.length} warning(s)`);
	process.exit(1);
}
const deepCount = registry.patterns.filter((pattern) => pattern.tier === 'deep').length;
console.error(
	`registry OK: ${registry.patterns.length} patterns (${deepCount} deep / ${registry.patterns.length - deepCount} light), 0 errors, ${warnings.length} warning(s)`,
);
