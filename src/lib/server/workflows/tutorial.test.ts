import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workflows } from '#lib/workflows/catalog.ts';
import { renderWorkflowTutorial, tutorialSourcePath } from './tutorial';

function tutorialText(slug: string): string {
	const card = workflows.find((c) => c.slug === slug);
	if (!card) throw new Error(`no workflow ${slug}`);
	return readFileSync(join(process.cwd(), tutorialSourcePath(card)), 'utf8');
}

describe('workflow tutorials', () => {
	it.each(workflows.map((card) => card.slug))('%s has a tutorial that renders', async (slug) => {
		const rendered = await renderWorkflowTutorial(slug);
		expect(rendered?.html).toContain('<h2');
		expect(rendered?.toc.length).toBeGreaterThan(0);
	});

	it('returns null for a slug the catalog does not list', async () => {
		expect(await renderWorkflowTutorial('no-such-workflow')).toBeNull();
	});

	// Office workflows are for people with folders and Excel, not a repository. A git
	// command, a package-manager script or a repo path in the tutorial shuts them out.
	it.each(
		workflows.filter((card) => card.category === 'office').map((card) => card.slug),
	)('%s assumes no git, repo or dev tooling', (slug) => {
		const text = tutorialText(slug);
		expect(text).not.toMatch(/\bgit\b/i);
		expect(text).not.toMatch(/\b(bun|npm|pnpm|yarn|npx|bunx)\b/);
		expect(text).not.toMatch(/\b(src|scripts|docs)\/[\w-]/);
		expect(text).not.toMatch(/\brepo(sitory)?\b/i);
	});
});
