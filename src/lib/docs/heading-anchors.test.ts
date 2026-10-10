import { describe, expect, it } from 'vitest';
import { headingAnchors } from './heading-anchors.server';

describe('headingAnchors', () => {
	it('matches the rendered ids, including the cases a hand-written slugger gets wrong', () => {
		const anchors = headingAnchors(
			[
				'---',
				'title: "x"',
				'---',
				'# Truth',
				'## Source-of-truth gate',
				'## Singleflight / stampede protection',
				'## The `derivation_key` column',
				'## Données & café',
				'## Overview',
				'## Overview',
				'```md',
				'## not a heading',
				'```',
			].join('\n'),
		);
		expect([...anchors]).toEqual([
			'truth',
			'source-of-truth-gate',
			'singleflight--stampede-protection',
			'the-derivation_key-column',
			'données--café',
			'overview',
			'overview-1',
		]);
	});
});
