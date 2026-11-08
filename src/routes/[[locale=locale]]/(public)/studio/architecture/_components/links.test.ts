import { describe, expect, it } from 'vitest';
import { evidenceHref, patternHref } from './links.ts';

describe('evidence links', () => {
	it('keeps app routes and external URLs as they are', () => {
		expect(evidenceHref('/showcases/wasm')).toEqual({ href: '/showcases/wasm', external: false });
		expect(evidenceHref('https://example.org/a')).toEqual({ href: 'https://example.org/a', external: true });
	});

	it('opens rendered docs in the app, with the anchor', () => {
		expect(evidenceHref('docs/blueprint/architecture/external-service.md#measurement').href).toBe(
			'/docs/blueprint/architecture/external-service#measurement',
		);
		expect(evidenceHref('docs/blueprint/db/README.md').href).toBe('/docs/blueprint/db');
	});

	it('opens other repository files on GitHub, without the anchor', () => {
		expect(evidenceHref('src/lib/wasm/bench.ts')).toEqual({
			href: 'https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/bench.ts',
			external: true,
		});
		expect(patternHref('query-budget')).toBe('/docs/pattern-library/query-budget');
	});
});
