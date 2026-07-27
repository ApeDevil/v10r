/**
 * OWNERSHIP PREDICATE GATE — a caller-supplied parent must be proven owned.
 *
 * Mutations reliably checked that the ROW being written belonged to the caller,
 * and just as reliably forgot the DESTINATION. `moveFile` scoped its WHERE by
 * `userId` and then wrote whatever `folderId` it was handed; `createFolder` did
 * the same with `parentId`. That produced cross-tenant trees which — because
 * `parent_id` is `ON DELETE CASCADE`, and Postgres cascades have no notion of a
 * user — the other party's ordinary delete would then reach into.
 *
 * The existing per-function tests did not catch it: every one of them passed
 * `null` as the destination, so the unchecked path was never exercised. That is
 * exactly the kind of hole a shape gate catches and a behaviour test misses.
 *
 * Rule: a file that writes a folder/parent FK must also reference
 * `assertOwnedDestination`.
 *
 * Honest limits: this proves the helper is mentioned in the file, not that it
 * is called on every branch or with the right table. It catches "forgot
 * entirely", which is the failure that actually occurred.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src', 'lib', 'server');

/** Writes a caller-supplied parent/folder FK into a row. */
const WRITES_PARENT_FK =
	/\.values\(\s*\{[^}]*\b(parentId|folderId)\b[^}]*\}|\.set\(\s*\{[^}]*\b(parentId|folderId)\b[^}]*\}/s;

/**
 * Files reviewed as not needing the check, with the reason.
 * `updatePostMetadata`/`updateAssetMetadata` DO call it — they are not here.
 */
const ALLOWLIST: Record<string, string> = {};

function candidateFiles(): string[] {
	return (readdirSync(SRC, { recursive: true }) as string[]).filter(
		(e) => e.endsWith('.ts') && !e.endsWith('.test.ts') && (e.includes('mutations') || e.includes('folders')),
	);
}

describe('ownership predicate', () => {
	it('scans a non-empty set of mutation modules', () => {
		expect(candidateFiles().length).toBeGreaterThan(3);
	});

	it('every module writing a parent FK also asserts destination ownership', () => {
		const offenders: string[] = [];
		for (const rel of candidateFiles()) {
			const source = readFileSync(join(SRC, rel), 'utf8');
			const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
			if (!WRITES_PARENT_FK.test(code)) continue;
			if (code.includes('assertOwnedDestination')) continue;
			if (ALLOWLIST[rel.split('\\').join('/')]) continue;
			offenders.push(rel);
		}
		expect(
			offenders,
			`These write a caller-supplied parentId/folderId without asserting the destination belongs to the user:\n  ${offenders.join('\n  ')}`,
		).toEqual([]);
	});

	it('the recursive folder walks stay owner-scoped in BOTH terms', () => {
		// Scoping only the seed lets the walk climb through another user's rows.
		// collectSubtreeIds feeds the audit log and the Neo4j sync, so an unscoped
		// recursive term made one user's delete emit operations on foreign rows.
		const source = readFileSync(join(SRC, 'db', 'shared', 'folder-tree.ts'), 'utf8');
		const recursiveTerms = source.match(/UNION ALL[\s\S]*?\)/g) ?? [];
		expect(recursiveTerms.length).toBeGreaterThanOrEqual(2);
		for (const term of recursiveTerms) {
			expect(term, 'a recursive CTE term lost its user_id filter').toMatch(/user_id/);
		}
	});
});
