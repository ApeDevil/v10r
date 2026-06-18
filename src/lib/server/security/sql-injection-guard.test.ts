/**
 * SQL injection hygiene (CVE-2026-39356 class): `sql.raw()` / `sql.identifier()`
 * bypass Drizzle's parameterization and must NEVER receive request-derived input.
 * Rather than try to prove intent per call, we pin the set of files allowed to use
 * them. A new occurrence fails this test, forcing a reviewer to confirm the
 * argument is a literal/constant/allowlisted value before adding the file here.
 *
 * Permanent rule: user input goes through the query builder or `${}` tagged-template
 * placeholders — never into sql.raw / sql.identifier / .as() with a dynamic value.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(process.cwd(), 'src');

// Files whose sql.raw/identifier usage has been reviewed as constant/safe.
const ALLOWLIST = new Set([
	'lib/server/db/analytics/seed.ts', // generated seed data, no request input
	'lib/server/db/rag/setup.ts', // HNSW index params from config constants
]);

const RAW_SQL_RE = /sql\.(raw|identifier)\(/;

function tsFiles(): string[] {
	const entries = readdirSync(SRC_DIR, { recursive: true }) as string[];
	return entries.filter((e) => e.endsWith('.ts') && !e.endsWith('.test.ts'));
}

describe('SQL injection guard', () => {
	it('sql.raw / sql.identifier appear only in reviewed, allowlisted files', () => {
		const offenders: string[] = [];
		for (const rel of tsFiles()) {
			const normalized = rel.split('\\').join('/');
			if (ALLOWLIST.has(normalized)) continue;
			const content = readFileSync(join(SRC_DIR, rel), 'utf8');
			if (RAW_SQL_RE.test(content)) offenders.push(normalized);
		}
		expect(
			offenders,
			`Unreviewed sql.raw/sql.identifier usage. Confirm the argument is NOT request-derived, then add the file to ALLOWLIST:\n${offenders.join('\n')}`,
		).toEqual([]);
	});
});
