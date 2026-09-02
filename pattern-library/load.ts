/**
 * Reads the registry off disk.
 *
 * Separate from `schema.ts` because `import.meta.dir` is a Bun API. The app imports the
 * registry as a static JSON module through Vite instead, and pulling this file into that
 * graph would break `svelte-check` — which is why the types live in `schema.ts` where
 * both runtimes can share one declaration.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRegistry, REGISTRY_FILENAME, type Registry } from './schema.ts';

/** Load and parse the registry JSON that sits next to this module. */
export function loadRegistry(dir: string = import.meta.dir): { registry: Registry | null; error: string | null } {
	let raw: string;
	try {
		raw = readFileSync(join(dir, REGISTRY_FILENAME), 'utf8');
	} catch (cause) {
		return { registry: null, error: `cannot read ${REGISTRY_FILENAME}: ${String(cause)}` };
	}
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (cause) {
		return { registry: null, error: `${REGISTRY_FILENAME} is not valid JSON: ${String(cause)}` };
	}
	const { registry, errors } = parseRegistry(data);
	return registry ? { registry, error: null } : { registry: null, error: errors.join('; ') };
}
