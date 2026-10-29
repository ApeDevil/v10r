import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales } from '#lib/i18n/index.ts';
import { workflows } from '#lib/workflows/catalog.ts';
import { renderWorkflowTutorial, tutorialSourcePath } from './tutorial';

const tutorials = workflows.flatMap((card) => locales.map((locale) => ({ card, locale })));

/** Every text file a reader of an office workflow gets: the tutorials and the starter folders. */
function officeTexts(): { path: string; text: string }[] {
	return workflows
		.filter((card) => card.category === 'office')
		.flatMap((card) => {
			const dir = join(process.cwd(), 'content/workflows', card.category, card.slug);
			return readdirSync(dir, { recursive: true, encoding: 'utf8' })
				.filter((path) => /\.(md|json|txt)$/.test(path))
				.map((path) => ({ path: `${card.slug}/${path}`, text: readFileSync(join(dir, path), 'utf8') }));
		});
}

describe('workflow tutorials', () => {
	it.each(tutorials.map(({ card, locale }) => [card.slug, locale]))('%s has a %s tutorial', async (slug, locale) => {
		const card = workflows.find((c) => c.slug === slug);
		if (!card) throw new Error(`no workflow ${slug}`);
		expect(readFileSync(join(process.cwd(), tutorialSourcePath(card, locale)), 'utf8')).toMatch(/^# /);

		const rendered = await renderWorkflowTutorial(slug, locale);
		expect(rendered?.locale).toBe(locale);
		expect(rendered?.html).toContain('<h2');
		expect(rendered?.toc.length).toBeGreaterThan(0);
	});

	it('links each tutorial to the starter folder of its own language', () => {
		for (const { card, locale } of tutorials) {
			const text = readFileSync(join(process.cwd(), tutorialSourcePath(card, locale)), 'utf8');
			for (const [, linkLocale] of text.matchAll(/\/starter-([a-z]{2})\.zip/g)) expect(linkLocale).toBe(locale);
		}
	});

	it('returns null for a slug the catalog does not list', async () => {
		expect(await renderWorkflowTutorial('no-such-workflow', 'en')).toBeNull();
	});

	// Office workflows are for people with folders and Excel, not a repository. A git
	// command, a package-manager script or a repo path in the tutorial or its starter
	// folder shuts them out.
	it.each(officeTexts().map(({ path, text }) => [path, text]))('%s assumes no git, repo or dev tooling', (_, text) => {
		expect(text).not.toMatch(/\bgit\b/i);
		expect(text).not.toMatch(/\b(bun|npm|pnpm|yarn|npx|bunx)\b/);
		expect(text).not.toMatch(/\b(src|scripts|docs)\/[\w-]/);
		expect(text).not.toMatch(/\brepo(sitory)?\b/i);
	});
});
