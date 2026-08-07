/**
 * overview-body — pure builder for the system-overview anchor body.
 *
 * The overview is the high-level "map" the chatbot injects as <project-overview> for broad
 * questions ("what is v10r", "which stack does it use"). Deterministic, no LLM.
 *
 * Extracted from scripts/db/ingest-docs.ts (which imports it back) so it is unit-testable
 * under vitest — the Bun ingester runs heavy module-level side effects on import
 * (env validation + process.exit, main() auto-run) and cannot be imported into a test.
 * Same Vite-free, dependency-light arrangement as the sibling doc-filter.ts.
 *
 * TRUNCATION CONTRACT: loadOverview() (src/lib/server/llmwiki/overview.ts) slices the body
 * to OVERVIEW_MAX_TOKENS * CHARS_PER_TOKEN (= 500 * 4 = 2000) chars before injection. The
 * intro paragraph and the **Stack:** line therefore live at the TOP of the body, ahead of
 * the per-section table of contents, so they always survive truncation. The huge `blueprint`
 * TOC below them may be cut — that is fine, but the stack summary must not be.
 */

/**
 * Minimal doc shape buildOverviewBody needs. The ingester's richer DocFile (which also
 * carries body/rawHash) structurally satisfies this, so it passes its files straight in.
 */
export interface OverviewDocFile {
	/** Canonical /docs path: `/docs/<section>/<slug>` — section is `split('/')[2]`. */
	docsPath: string;
	/** Repo-relative source: `docs/<section>/<subsection>/<file>.md` — subsection is `split('/')[2]`. */
	sourcePath: string;
	/** Doc title (frontmatter.title or first H1). For a stack doc this IS the technology name. */
	title: string;
}

/**
 * Stack subsections whose doc titles name a foundational technology (Bun, Drizzle, UnoCSS,
 * …). Capability/ops/notification subsections (`capabilities`, `ops`, `notifications`) are
 * features and operational concerns — not "the stack" — so they are excluded to keep the
 * summary high-signal. This is STRUCTURAL scoping by directory; the technology NAMES still
 * come from the docs' titles, never a hardcoded list.
 */
const CORE_STACK_SUBSECTIONS = new Set(['ai', 'auth', 'core', 'data', 'forms', 'i18n', 'quality', 'ui']);

/**
 * One compact, alphabetical line naming the stack, derived from the titles of the core
 * stack-section docs. Returns '' when no stack docs are present.
 */
function buildStackLine(files: OverviewDocFile[]): string {
	const tech = files
		.filter((f) => f.docsPath.split('/')[2] === 'stack' && CORE_STACK_SUBSECTIONS.has(f.sourcePath.split('/')[2]))
		.map((f) => f.title);
	const unique = [...new Set(tech)].sort((a, b) => a.localeCompare(b));
	return unique.length ? `\n**Stack:** ${unique.join(' · ')}\n` : '';
}

/** Build the deterministic overview body: intro + one-line stack summary + section-grouped TOC. No LLM. */
export function buildOverviewBody(files: OverviewDocFile[]): string {
	const bySection = new Map<string, OverviewDocFile[]>();
	for (const f of files) {
		const section = f.docsPath.split('/')[2] ?? 'other';
		const arr = bySection.get(section);
		if (arr) arr.push(f);
		else bySection.set(section, [f]);
	}
	const order = ['foundation', 'blueprint', 'stack', 'pattern-library'];
	const sections = [...bySection.keys()].sort(
		(a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b),
	);
	let body =
		'# Velociraptor (v10r) — Documentation Map\n\n' +
		'v10r is a full-stack reference & test-sandbox: proven, high-performance full-stack patterns an AI ' +
		'agent reads and adapts (emulation, not cloning). This map lists the documentation corpus by section ' +
		'so broad questions can find the right area, then drill into the specific doc.\n';
	// Deterministic stack summary placed in the intro, BEFORE the per-section TOC, so it lands
	// within the first ~600 chars and survives loadOverview's 2000-char truncation. Without this,
	// `## stack` sorts last and is cut by the large `blueprint` TOC — the original grounding bug.
	body += buildStackLine(files);
	for (const section of sections) {
		const docs = [...(bySection.get(section) ?? [])].sort((a, b) => a.title.localeCompare(b.title));
		body += `\n## ${section}\n`;
		for (const d of docs) body += `- ${d.title} (${d.docsPath})\n`;
	}
	return body;
}
