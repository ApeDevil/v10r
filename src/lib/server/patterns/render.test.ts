import { describe, expect, it } from 'vitest';
import type { PatternRecord, Registry } from '../mcp/patterns/data';
import {
	anchorFor,
	docsUrlFor,
	frontmatterDescription,
	README_MARKER_END,
	README_MARKER_START,
	type RenderOpts,
	renderPatternPage,
	renderPatternsHub,
	renderReadmeIndex,
} from './render';

function makePattern(overrides: Partial<PatternRecord>): PatternRecord {
	return {
		id: 'test-pattern',
		tier: 'light',
		title: 'Test pattern',
		category: 'alpha',
		summary: 'A test pattern.',
		when_to_use: 'When testing.',
		capabilities: [],
		keywords: ['test'],
		depends_on: [],
		docs: [{ path: 'docs/blueprint/alpha/thing.md' }],
		code: [],
		tests: [],
		showcases: [],
		invariants: [],
		emulation_notes: [],
		risk: 'low — test only',
		...overrides,
	};
}

const DEEP = makePattern({
	id: 'alpha-deep',
	tier: 'deep',
	title: 'Deep pattern',
	capabilities: ['deep things'],
	invariants: ['never break'],
	emulation_notes: ['copy carefully'],
	code: [{ path: 'src/lib/server/alpha', kind: 'dir' }],
	tests: [{ path: 'src/lib/server/alpha/alpha.test.ts' }],
	showcases: [{ path: '/showcases/alpha', kind: 'route' }],
});

const LIGHT = makePattern({
	id: 'alpha-light',
	title: 'Light pattern',
	depends_on: ['alpha-deep'],
	showcases: [{ path: '/admin/alpha', kind: 'approute', note: 'POST' }],
});

const REGISTRY: Registry = {
	version: '2.0.0',
	groups: [
		{ id: 'g-one', title: 'Group One' },
		{ id: 'g-two', title: 'Group Two' },
	],
	categories: [
		{ id: 'alpha', title: 'Architecture & Request Pipeline', group: 'g-one' },
		{ id: 'beta', title: 'Internationalization (i18n)', group: 'g-two' },
		{ id: 'empty-cat', title: 'Empty', group: 'g-two' },
	],
	patterns: [DEEP, LIGHT, makePattern({ id: 'beta-solo', title: 'Beta solo', category: 'beta' })],
};

const ALL_PUBLISHED: RenderOpts = { isPublishedDoc: () => true };
const NONE_PUBLISHED: RenderOpts = { isPublishedDoc: () => false };

describe('anchorFor', () => {
	// Pinned to GitHub's live anchor output for today's section titles — the TOC
	// links break silently if this drifts.
	it('reproduces GitHub heading anchors', () => {
		expect(anchorFor('Architecture & Request Pipeline')).toBe('architecture--request-pipeline');
		expect(anchorFor('Internationalization (i18n)')).toBe('internationalization-i18n');
		expect(anchorFor('Content, Blog & Desk')).toBe('content-blog--desk');
		expect(anchorFor('3D')).toBe('3d');
	});
});

describe('docsUrlFor', () => {
	it('keeps blueprint paths nested', () => {
		expect(docsUrlFor('docs/blueprint/ai/layered-rag.md', true)).toBe('/docs/blueprint/ai/layered-rag');
	});
	it('flattens stack, foundation, and pattern-library to slugified basenames', () => {
		expect(docsUrlFor('docs/stack/data/postgres.md', true)).toBe('/docs/stack/postgres');
		expect(docsUrlFor('docs/foundation/style.md', true)).toBe('/docs/foundation/style');
		expect(docsUrlFor('docs/pattern-library/jobs-scheduler.md', true)).toBe('/docs/pattern-library/jobs-scheduler');
	});
	it('maps repo-root entry points to their rendered ROOT_DOCS page', () => {
		expect(docsUrlFor('docs/system-abstraction.md', true)).toBe('/docs/system-abstraction');
	});
	it('returns null for unpublished or non-docs paths', () => {
		expect(docsUrlFor('docs/blueprint/blog.md', false)).toBeNull();
		expect(docsUrlFor('README.md', true)).toBeNull();
		expect(docsUrlFor('docs/guides/thing.md', true)).toBeNull();
	});
});

describe('frontmatterDescription', () => {
	it('collapses whitespace and passes short text through', () => {
		expect(frontmatterDescription('A  test\n pattern.')).toBe('A test pattern.');
	});
	it('word-truncates long text to at most 160 chars with an ellipsis', () => {
		const long = 'word '.repeat(60);
		const out = frontmatterDescription(long);
		expect(out.length).toBeLessThanOrEqual(160);
		expect(out.endsWith('…')).toBe(true);
	});
});

describe('renderReadmeIndex', () => {
	const region = renderReadmeIndex(REGISTRY);

	it('is wrapped in the exact marker comments', () => {
		expect(region.startsWith(README_MARKER_START)).toBe(true);
		expect(region.endsWith(README_MARKER_END)).toBe(true);
	});
	it('renders the grouped TOC with anchor links', () => {
		expect(region).toContain('- **Group One:** [Architecture & Request Pipeline](#architecture--request-pipeline)');
		expect(region).toContain('- **Group Two:** [Internationalization (i18n)](#internationalization-i18n)');
	});
	it('bolds deep rows and links every pattern to its page', () => {
		expect(region).toContain('[**Deep pattern**](docs/pattern-library/alpha-deep.md)');
		expect(region).toContain('[Light pattern](docs/pattern-library/alpha-light.md)');
	});
	it('renders showcase, approute, and empty cells with the README conventions', () => {
		expect(region).toContain('`/showcases/alpha`');
		expect(region).toContain('— (`POST /admin/alpha`)');
		expect(region).toMatch(/\| \[Beta solo\]\(docs\/pattern-library\/beta-solo\.md\) \| .* \| — \| — \|/);
	});
	it('omits categories with no patterns', () => {
		expect(region).not.toContain('### Empty');
	});
});

describe('renderPatternPage', () => {
	it('emits quoted frontmatter and the deep sections', () => {
		const page = renderPatternPage(DEEP, REGISTRY, ALL_PUBLISHED);
		expect(page).toContain('title: "Deep pattern"');
		expect(page).toContain('description: "A test pattern."');
		expect(page).toContain('category: "Architecture & Request Pipeline"');
		expect(page).toContain('## Invariants');
		expect(page).toContain('- never break');
		expect(page).toContain('## Emulation notes');
		expect(page).toContain('- `src/lib/server/alpha/`');
	});
	it('labels light pages as index cards and omits deep sections', () => {
		const page = renderPatternPage(LIGHT, REGISTRY, ALL_PUBLISHED);
		expect(page).toContain('_Index card —');
		expect(page).not.toContain('## Invariants');
		expect(page).not.toContain('## Emulation notes');
	});
	it('links published docs and code-spans unpublished ones', () => {
		const linked = renderPatternPage(LIGHT, REGISTRY, ALL_PUBLISHED);
		expect(linked).toContain('[docs/blueprint/alpha/thing.md](/docs/blueprint/alpha/thing)');
		const unlinked = renderPatternPage(LIGHT, REGISTRY, NONE_PUBLISHED);
		expect(unlinked).toContain('- `docs/blueprint/alpha/thing.md`');
		expect(unlinked).not.toContain('](/docs/blueprint/alpha/thing)');
	});
	it('appends GitHub and GitLab source links to docs, code, and tests refs', () => {
		const page = renderPatternPage(DEEP, REGISTRY, ALL_PUBLISHED);
		expect(page).toContain(
			'- [docs/blueprint/alpha/thing.md](/docs/blueprint/alpha/thing) ' +
				'([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/alpha/thing.md) · ' +
				'[GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/alpha/thing.md))',
		);
		expect(page).toContain(
			'- `src/lib/server/alpha/` ' +
				'([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/alpha) · ' +
				'[GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/alpha))',
		);
		expect(page).toContain(
			'- `src/lib/server/alpha/alpha.test.ts` ' +
				'([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/alpha/alpha.test.ts) · ' +
				'[GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/alpha/alpha.test.ts))',
		);
	});
	it('drops #fragments from host links but keeps them in the shown label', () => {
		const fragmented = makePattern({
			id: 'frag',
			docs: [{ path: 'docs/blueprint/alpha/thing.md#section' }],
		});
		const page = renderPatternPage(fragmented, REGISTRY, ALL_PUBLISHED);
		expect(page).toContain('[docs/blueprint/alpha/thing.md#section](/docs/blueprint/alpha/thing)');
		expect(page).toContain('[GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/alpha/thing.md)');
		expect(page).not.toContain('blob/main/docs/blueprint/alpha/thing.md#section');
	});
	it('code-spans dir docs refs without consulting the publish predicate', () => {
		const withDirDoc = makePattern({
			id: 'dir-doc',
			docs: [{ path: 'docs/stack/notifications', kind: 'dir' }],
		});
		const throwing: RenderOpts = {
			isPublishedDoc: () => {
				throw new Error('dir refs must not be publish-checked');
			},
		};
		const page = renderPatternPage(withDirDoc, REGISTRY, throwing);
		expect(page).toContain('- `docs/stack/notifications/`');
	});
	it('links depends_on to sibling pattern pages by title', () => {
		const page = renderPatternPage(LIGHT, REGISTRY, ALL_PUBLISHED);
		expect(page).toContain('[Deep pattern](/docs/pattern-library/alpha-deep)');
	});
	it('uses the category title, not the id', () => {
		const page = renderPatternPage(DEEP, REGISTRY, ALL_PUBLISHED);
		expect(page).toContain('**Category:** Architecture & Request Pipeline · **Tier:** deep');
	});
});

describe('renderPatternsHub', () => {
	const hub = renderPatternsHub(REGISTRY);

	it('lists every pattern under its category with bold deep entries', () => {
		expect(hub).toContain('### Architecture & Request Pipeline');
		expect(hub).toContain('- [**Deep pattern**](./alpha-deep.md)');
		expect(hub).toContain('- [Light pattern](./alpha-light.md)');
	});
	it('states the tier split in the intro', () => {
		expect(hub).toContain('3 patterns (1 deep cards / 2 index rows)');
	});
	it('points at the in-app section, not a markdown catalog file', () => {
		expect(hub).toContain('`/docs/pattern-library`');
		expect(hub).not.toContain('pattern-library.md');
	});
});
