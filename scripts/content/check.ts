#!/usr/bin/env bun
/**
 * Drift + parity audit for file-managed content.
 *
 * Validates per slug:
 *   1. en.md exists with valid frontmatter (id uuid, slug, title)
 *   2. Each non-EN locale present (warn always; fail in --strict)
 *   3. Each non-EN's sourceContentHash matches current EN's contentHash (warn; fail in --strict)
 *   4. DB drift: file en.md hash matches the latest published EN revision (warn; fail in --strict)
 *   5. Orphans: DB rows with sourcePath set but file gone (warn always; fail in --strict)
 *
 * Exit codes:
 *   0  no issues
 *   1  argument error
 *   2  drift detected (in --strict only)
 *
 * Mirrors `scripts/i18n/check-missing.ts` for muscle memory.
 *
 * Usage:
 *   bun run content:check
 *   bun run content:check --strict
 *   bun run content:check --json
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { isLocale, type Locale, locales } from '$lib/i18n/runtime';
import { contentHash, FrontmatterError, findOrphanedSourcePaths, parseContentFile } from '$lib/server/content';
import { post, publishedRevision, revision } from '$lib/server/db/schema/blog';
import { db, pool } from './_db';

interface Flags {
	strict: boolean;
	json: boolean;
}

function parseArgs(argv: string[]): Flags {
	const flags: Flags = { strict: false, json: false };
	for (const arg of argv) {
		if (arg === '--strict') flags.strict = true;
		else if (arg === '--json') flags.json = true;
		else {
			console.error(`unknown flag: ${arg}`);
			process.exit(1);
		}
	}
	return flags;
}

const flags = parseArgs(process.argv.slice(2));

interface Issue {
	level: 'warn' | 'error';
	slug: string;
	locale?: Locale;
	code:
		| 'missing_en'
		| 'invalid_frontmatter'
		| 'missing_locale'
		| 'stale_translation'
		| 'unpushed'
		| 'unknown_locale_file'
		| 'orphan';
	message: string;
}

const issues: Issue[] = [];

const root = join(process.cwd(), 'content', 'blog');
let slugs: string[] = [];
try {
	slugs = (await readdir(root)).filter((s) => !s.startsWith('.'));
} catch (err: unknown) {
	if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

for (const slug of slugs.sort()) {
	const slugDir = join(root, slug);
	let isDir = false;
	try {
		isDir = (await stat(slugDir)).isDirectory();
	} catch {
		continue;
	}
	if (!isDir) continue;

	let entries: string[];
	try {
		entries = await readdir(slugDir);
	} catch {
		continue;
	}

	const localeFiles = new Map<Locale, string>();
	for (const entry of entries) {
		if (!entry.endsWith('.md')) continue;
		const stem = entry.replace(/\.md$/, '');
		if (!isLocale(stem)) {
			issues.push({ level: 'warn', slug, code: 'unknown_locale_file', message: `unknown locale file: ${entry}` });
			continue;
		}
		localeFiles.set(stem, join(slugDir, entry));
	}

	const enPath = localeFiles.get('en');
	if (!enPath) {
		issues.push({ level: 'error', slug, code: 'missing_en', message: 'en.md missing' });
		continue;
	}

	const enText = await readFile(enPath, 'utf8');
	let enParsed: ReturnType<typeof parseContentFile>;
	try {
		enParsed = parseContentFile(enText, enPath);
	} catch (err) {
		const message = err instanceof FrontmatterError ? err.message : String(err);
		issues.push({ level: 'error', slug, locale: 'en', code: 'invalid_frontmatter', message });
		continue;
	}

	const enHash = await contentHash(enParsed.body);

	// 1+2: every non-en locale present
	for (const locale of locales) {
		if (locale === 'en') continue;
		if (!localeFiles.has(locale)) {
			issues.push({
				level: flags.strict ? 'error' : 'warn',
				slug,
				locale,
				code: 'missing_locale',
				message: `${locale}.md missing`,
			});
			continue;
		}
		const localePath = localeFiles.get(locale);
		if (!localePath) continue;
		const localeText = await readFile(localePath, 'utf8');
		try {
			const parsed = parseContentFile(localeText, localePath);
			if (!parsed.frontmatter.sourceContentHash) {
				issues.push({
					level: flags.strict ? 'error' : 'warn',
					slug,
					locale,
					code: 'stale_translation',
					message: 'sourceContentHash missing — set it to the current en.md hash to confirm translation freshness',
				});
			} else if (parsed.frontmatter.sourceContentHash !== enHash) {
				issues.push({
					level: flags.strict ? 'error' : 'warn',
					slug,
					locale,
					code: 'stale_translation',
					message: `sourceContentHash ${parsed.frontmatter.sourceContentHash.slice(0, 12)}… ≠ current en.md hash ${enHash.slice(0, 12)}… (re-translate or refresh)`,
				});
			}
		} catch (err) {
			const message = err instanceof FrontmatterError ? err.message : String(err);
			issues.push({ level: 'error', slug, locale, code: 'invalid_frontmatter', message });
		}
	}

	// 3: DB drift for the EN file
	const [latestEn] = await db
		.select({ hash: revision.contentHash })
		.from(post)
		.innerJoin(publishedRevision, and(eq(publishedRevision.postId, post.id), eq(publishedRevision.locale, 'en')))
		.innerJoin(revision, eq(publishedRevision.revisionId, revision.id))
		.where(and(eq(post.slug, enParsed.frontmatter.slug), isNull(post.deletedAt)))
		.limit(1);

	if (!latestEn) {
		issues.push({
			level: 'warn',
			slug,
			locale: 'en',
			code: 'unpushed',
			message: 'no published EN revision in DB — run `bun run content:push`',
		});
	} else if (latestEn.hash !== enHash) {
		issues.push({
			level: flags.strict ? 'error' : 'warn',
			slug,
			locale: 'en',
			code: 'unpushed',
			message: `file hash ${enHash.slice(0, 12)}… ≠ DB hash ${latestEn.hash.slice(0, 12)}… (run \`bun run content:push ${slug}\`)`,
		});
	}
}

// 5: orphan DB rows (sourcePath set, file gone)
for (const orphan of await findOrphanedSourcePaths(db)) {
	issues.push({
		level: flags.strict ? 'error' : 'warn',
		slug: orphan.slug,
		code: 'orphan',
		message: `DB row claims sourcePath ${orphan.sourcePath} but the file is gone`,
	});
}

// ── Report ──
if (flags.json) {
	for (const issue of issues) console.log(JSON.stringify(issue));
	console.log(
		JSON.stringify({ summary: { total: issues.length, errors: issues.filter((i) => i.level === 'error').length } }),
	);
} else {
	for (const issue of issues) {
		const sigil = issue.level === 'error' ? '✗' : '⚠';
		const where = issue.locale ? `${issue.slug}/${issue.locale}` : issue.slug;
		console.error(`${sigil} ${where}: ${issue.message}`);
	}
	if (issues.length === 0) console.log('[content:check] OK — no drift detected');
	else
		console.error(
			`\n[content:check] ${issues.length} issue(s) — ${issues.filter((i) => i.level === 'error').length} error(s)`,
		);
}

await pool.end();
const hasErrors = issues.some((i) => i.level === 'error');
process.exit(hasErrors ? 2 : 0);
