#!/usr/bin/env bun
/**
 * Push file-managed content to the database.
 *
 * Usage:
 *   bun run content:push                          # push every slug under content/blog/
 *   bun run content:push <slug> [<slug> ...]      # push specific slugs
 *   bun run content:push --all
 *   bun run content:push --dry-run                # report what would change
 *   bun run content:push --json                   # NDJSON output (one action per line) + summary
 *
 * Exit codes:
 *   0  all pushes succeeded (or were skipped)
 *   1  invalid arguments
 *   2  one or more slugs failed (others may have succeeded)
 */

import { listContentSlugs, pushPost, summarizeActions } from '$lib/server/content';
import { createR2, db, pool } from './_db';

interface CliFlags {
	dryRun: boolean;
	json: boolean;
	all: boolean;
}

function parseArgs(argv: string[]): { slugs: string[]; flags: CliFlags } {
	const slugs: string[] = [];
	const flags: CliFlags = { dryRun: false, json: false, all: false };
	for (const arg of argv) {
		if (arg === '--dry-run') flags.dryRun = true;
		else if (arg === '--json') flags.json = true;
		else if (arg === '--all') flags.all = true;
		else if (arg.startsWith('--')) {
			console.error(`unknown flag: ${arg}`);
			process.exit(1);
		} else slugs.push(arg);
	}
	return { slugs, flags };
}

const { slugs, flags } = parseArgs(process.argv.slice(2));

const targets = slugs.length > 0 ? slugs : await listContentSlugs('blog');
if (targets.length === 0) {
	console.log('[content:push] no slugs found under content/blog/');
	process.exit(0);
}

const r2 = createR2();
if (!r2) {
	console.warn(
		'[content:push] R2 env vars not set (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) — relative-path assets will fail to push',
	);
}

let allOk = true;

for (const slug of targets) {
	try {
		const actions = await pushPost(slug, {
			db,
			...(r2 && { r2 }),
			dryRun: flags.dryRun,
		});
		const summary = summarizeActions(actions);

		if (flags.json) {
			for (const a of actions) console.log(JSON.stringify({ slug, ...a }));
		} else {
			const verb = flags.dryRun ? 'would' : '';
			const segs: string[] = [];
			if (summary.created.length > 0) segs.push(`${verb} create ${summary.created.length}`.trim());
			if (summary.updated.length > 0) segs.push(`${verb} update ${summary.updated.length}`.trim());
			if (summary.skipped.length > 0) segs.push(`skip ${summary.skipped.length}`);
			if (summary.failed.length > 0) segs.push(`fail ${summary.failed.length}`);
			console.log(`[${slug}] ${segs.join(', ') || 'no changes'}`);
			for (const f of summary.failed) {
				console.error(`  ✗ ${f.ref.locale}: ${f.code}: ${f.message}`);
				allOk = false;
			}
		}
		if (summary.failed.length > 0) allOk = false;
	} catch (err: unknown) {
		console.error(`[${slug}] failed: ${err instanceof Error ? err.message : String(err)}`);
		allOk = false;
	}
}

if (flags.json) {
	console.log(JSON.stringify({ summary: { ok: allOk, slugs: targets.length } }));
}

await pool.end();
process.exit(allOk ? 0 : 2);
