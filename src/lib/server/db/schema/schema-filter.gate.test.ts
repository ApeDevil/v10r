/**
 * `drizzle.config.ts`'s `schemaFilter` must list exactly the namespaces the schema declares.
 *
 * A namespace missing from the filter is not an error `db:push` reports — it is one it
 * silently skips, so the tables simply never appear and the first symptom is a runtime
 * "relation does not exist" against production. CLAUDE.md has warned about this in prose
 * since the beginning; the rename of `rag` → `retrieval` is what proved prose insufficient,
 * because the schema was updated and the filter was not.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function declaredNamespaces(): string[] {
	const found = new Set<string>();
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) walk(path);
			else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) {
				for (const m of readFileSync(path, 'utf8').matchAll(/pgSchema\('([a-z_]+)'\)/g)) found.add(m[1]);
			}
		}
	};
	walk(join(ROOT, 'src/lib/server/db/schema'));
	return [...found].sort();
}

function filteredNamespaces(): string[] {
	const source = readFileSync(join(ROOT, 'drizzle.config.ts'), 'utf8');
	const block = source.match(/schemaFilter:\s*\[([^\]]*)\]/s);
	if (!block) throw new Error('drizzle.config.ts has no schemaFilter array');
	return [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

describe('drizzle schemaFilter', () => {
	it('lists exactly the declared pgSchema namespaces', () => {
		expect(filteredNamespaces()).toEqual(declaredNamespaces());
	});
});
