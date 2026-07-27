/**
 * GUARD CONTRACT GATE — the check `guards.test.ts` structurally could not make.
 *
 * The API guards used to `throw apiError(...)`, which throws a bare `Response`.
 * SvelteKit special-cases only `HttpError` and `Redirect`, so every one of those
 * throws became a 500 rather than the intended 401/403. It survived because the
 * unit test asserted `.status` — and a `Response` has a `.status` too.
 *
 * Behaviour is asserted in `auth/guards.test.ts`. This file asserts the SHAPE of
 * the source, which is what actually prevents the class of mistake returning:
 * you cannot reintroduce the bug without editing a line this test reads.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const GUARDS = join(SRC, 'lib', 'server', 'auth', 'guards.ts');

function endpointFiles(): string[] {
	const routes = join(SRC, 'routes');
	return (readdirSync(routes, { recursive: true }) as string[])
		.filter((e) => e.endsWith('+server.ts'))
		.map((e) => join(routes, e));
}

describe('guard contract', () => {
	it('guards.ts never throws an apiError Response', () => {
		const source = readFileSync(GUARDS, 'utf8');
		// Strip comments so the explanatory docblocks about the old bug don't
		// trip the very check they describe.
		const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
		expect(code).not.toMatch(/throw\s+apiError\s*\(/);
	});

	it('the deleted throw-style API guards stay deleted', () => {
		const code = readFileSync(GUARDS, 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*$/gm, '');
		for (const gone of ['requireApiUser', 'requireApiBlogAuthor', 'requirePostOwnership', 'requireAssetOwnership']) {
			expect(code, `${gone} was reintroduced — use the guardApi*/guardXOwnership family instead`).not.toMatch(
				new RegExp(`function\\s+${gone}\\b`),
			);
		}
	});

	it('no endpoint throws an apiError Response either', () => {
		const offenders: string[] = [];
		for (const file of endpointFiles()) {
			const code = readFileSync(file, 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*$/gm, '');
			if (/throw\s+apiError\s*\(/.test(code)) {
				offenders.push(file.replace(SRC, 'src'));
			}
		}
		expect(
			offenders,
			`These endpoints throw a Response, which SvelteKit turns into a 500. Return it instead:\n  ${offenders.join('\n  ')}`,
		).toEqual([]);
	});
});
