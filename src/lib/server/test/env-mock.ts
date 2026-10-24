/**
 * A stand-in for `$app/env/private` in Vitest, built from the `src/env.ts` declaration.
 *
 * SvelteKit's real module captures each value once, at import. Tests set and delete
 * `process.env` between cases, so the stand-in exposes every declared variable as a getter
 * over `read`, which runs on each access.
 */
import { variables } from '../../../env.ts';

export function envModule(read: (name: string) => string | undefined): Record<string, string | undefined> {
	const module: Record<string, string | undefined> = {};
	for (const name of Object.keys(variables)) {
		Object.defineProperty(module, name, { enumerable: true, get: () => read(name) });
	}
	return module;
}
