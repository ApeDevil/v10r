/**
 * FOLDER-TREE SERIALIZATION GATE — a guarded read must hold the tree lock.
 *
 * `isCycleMove` and `collectSubtreeIds` answer questions about the shape of a tree, and
 * every caller then writes based on the answer. Nothing made that pair atomic: two moves
 * could each be told "no cycle" and together commit one. The result is a component with
 * no root, which leaves the Explorer entirely and which `collectSubtreeIds` then walks
 * forever — `UNION ALL` has no reason to stop going round — so a later recursive delete
 * pins its connection until something kills it.
 *
 * Rule: a function that calls a folder-tree walk runs inside `db.transaction` and calls
 * `lockFolderTree` before its first walk, and every walk reads through `tx`.
 *
 * The ordering half is the point. A lock taken after the check, or a walk issued through
 * the pool while the transaction holds the lock, reads a snapshot the lock never covered
 * — both look correct in review, and neither is.
 *
 * Honest limits: this proves shape, not that the lock guards the right tree, and it
 * cannot prove exclusion at all. That needs two connections to a real Postgres; see the
 * header of `folder-tree.pglite.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVER = join(process.cwd(), 'src', 'lib', 'server');

/** The reads whose answer a concurrent write can invalidate. */
const WALK = /\b(?:isCycleMove|collectSubtreeIds)\(/;

function mutationModules(): string[] {
	return (readdirSync(SERVER, { recursive: true }) as string[])
		.map((e) => e.split('\\').join('/'))
		.filter((e) => e.endsWith('.ts') && !e.includes('.test.') && !e.endsWith('db/shared/folder-tree.ts'));
}

/** Split a module into top-level function chunks, keyed by name. */
function functionsIn(source: string): { name: string; body: string }[] {
	return source
		.split(/\nexport (?:async )?function /)
		.slice(1)
		.map((chunk) => ({ name: chunk.split(/[(<\s]/)[0], body: chunk }));
}

/** Code only — comments here name the walks while explaining why they are guarded. */
function codeOf(rel: string): string {
	return readFileSync(join(SERVER, rel), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '');
}

function guardedFunctions(): { where: string; body: string }[] {
	const found: { where: string; body: string }[] = [];
	for (const rel of mutationModules()) {
		const source = codeOf(rel);
		if (!WALK.test(source)) continue;
		for (const fn of functionsIn(source)) {
			if (WALK.test(fn.body)) found.push({ where: `${rel} → ${fn.name}`, body: fn.body });
		}
	}
	return found;
}

describe('folder-tree serialization', () => {
	it('finds every folder move and recursive delete', () => {
		// Three domains × (move, delete). A drop here means the scan stopped seeing them,
		// not that the problem went away.
		expect(
			guardedFunctions()
				.map((f) => f.where)
				.sort(),
		).toEqual([
			'blog/asset-folders.ts → deleteAssetFolder',
			'blog/asset-folders.ts → moveAssetFolder',
			'blog/post-folders.ts → deletePostFolder',
			'blog/post-folders.ts → movePostFolder',
			'db/desk/mutations.ts → deleteFolder',
			'db/desk/mutations.ts → moveFolder',
		]);
	});

	it('every guarded function locks the tree before it reads it', () => {
		const offenders: string[] = [];
		for (const { where, body } of guardedFunctions()) {
			const lock = body.search(/\blockFolderTree\(tx,/);
			const walk = body.search(WALK);
			if (!/\bdb\.transaction\(/.test(body)) offenders.push(`${where} (no transaction)`);
			else if (lock === -1) offenders.push(`${where} (never locks the tree)`);
			else if (lock > walk) offenders.push(`${where} (locks after reading)`);
		}
		expect(offenders, `check-then-act against a folder tree:\n  ${offenders.join('\n  ')}`).toEqual([]);
	});

	it('no walk reads through the pool instead of the locked transaction', () => {
		const offenders: string[] = [];
		for (const rel of mutationModules()) {
			if (/\b(?:isCycleMove|collectSubtreeIds)\(db,/.test(codeOf(rel))) offenders.push(rel);
		}
		expect(offenders, `these read outside the transaction holding the lock:\n  ${offenders.join('\n  ')}`).toEqual([]);
	});
});
