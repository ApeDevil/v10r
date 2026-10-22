/**
 * The external service is optional, and this gate is what makes that a property of the
 * code rather than a hope:
 *
 * 1. Only the showcase's own three directories and its route import the adapter, so
 *    removing the service — or the whole showcase — cannot break anything else in v10r.
 * 2. The service's environment variables are named in exactly one module
 *    (`targets.adapter.ts`, server-only), so a credential has one way in and no way out
 *    to a client bundle, a log helper or a second reader.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const OWN_DIRS = [
	'src/lib/server/showcases/external-service/',
	'src/lib/showcases/external-service/',
	'src/lib/components/showcases/external-service/',
	'src/routes/[[locale=locale]]/(public)/showcases/external-service/',
];

/** Files allowed to name the variables: the reader, and the test tripwire that erases them. */
const ENV_READERS = [
	'src/lib/server/showcases/external-service/targets.adapter.ts',
	'src/lib/server/test/vitest.setup.ts',
];

function sourceFiles(): string[] {
	return readdirSync('src', { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.(ts|js|svelte)$/.test(entry.name))
		.map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll('\\', '/'))
		.filter((path) => !path.startsWith('src/lib/paraglide/'));
}

describe('external service isolation', () => {
	const files = sourceFiles();

	it('scans the source tree', () => {
		expect(files.length).toBeGreaterThan(1000);
	});

	it('is imported only by the showcase that owns it', () => {
		// Static `from '…'` and dynamic `import('…')` alike.
		const importsClient = /(?:from\s+|import\s*\(\s*)['"][^'"]*showcases\/external-service[^'"]*['"]/;
		const offenders = files.filter(
			(path) => !OWN_DIRS.some((dir) => path.startsWith(dir)) && importsClient.test(readFileSync(path, 'utf8')),
		);
		expect(offenders, 'only the External Service Lab may import its service client').toEqual([]);
	});

	it('ships copy as resolved strings, not per-locale message modules', () => {
		// A Paraglide message bundles all three locales into the client; the lab resolves its
		// copy in `load` instead (`labels.ts`). A component importing either would undo that —
		// it is what pushed the client-JS ratchet over its ceiling once.
		const svelte = files.filter((path) => path.endsWith('.svelte') && OWN_DIRS.some((dir) => path.startsWith(dir)));
		expect(svelte.length).toBeGreaterThan(0);
		// Value imports only: `import type { ExternalServiceCopy }` is erased and ships nothing.
		const shipsMessages =
			/^import (?!type )[^\n]*from ['"]\$lib\/(paraglide\/messages|showcases\/external-service\/labels)['"]/m;
		expect(svelte.filter((path) => shipsMessages.test(readFileSync(path, 'utf8')))).toEqual([]);
	});

	it('names its environment variables in one server-only module', () => {
		const readers = files.filter((path) =>
			/EXTERNAL_SERVICE_(LOCAL|REMOTE)_(URL|TOKEN)/.test(readFileSync(path, 'utf8')),
		);
		expect(readers.sort()).toEqual([...ENV_READERS].sort());
	});
});
