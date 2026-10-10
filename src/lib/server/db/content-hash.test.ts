import { describe, expect, it } from 'vitest';
import { contentHash, derivationKey } from './content-hash';

describe('derivationKey', () => {
	it('is stable for the same transform and inputs', async () => {
		expect(await derivationKey('docs-ingest@1', ['a', 'b'])).toBe(await derivationKey('docs-ingest@1', ['a', 'b']));
	});

	// The case a content hash cannot see: the bytes did not move, the code that reads them did.
	it('changes when only the transform version changes', async () => {
		expect(await derivationKey('docs-ingest@2', ['a', 'b'])).not.toBe(await derivationKey('docs-ingest@1', ['a', 'b']));
	});

	it('changes when any single input changes, and when inputs reorder', async () => {
		const base = await derivationKey('t@1', ['a', 'b']);
		expect(await derivationKey('t@1', ['a', 'c'])).not.toBe(base);
		expect(await derivationKey('t@1', ['b', 'a'])).not.toBe(base);
	});

	it('does not let input boundaries shift', async () => {
		expect(await derivationKey('t@1', ['ab', 'c'])).not.toBe(await derivationKey('t@1', ['a', 'bc']));
	});

	it('is not the content hash of the input itself', async () => {
		expect(await derivationKey('t@1', ['x'])).not.toBe(await contentHash('x'));
	});
});
