/**
 * File-as-source push: read content/<domain>/<slug>/<locale>.md, ensure the
 * post row exists, and create+publish a revision per locale where the file's
 * contentHash differs from the latest published revision.
 *
 * Invariants:
 *   - Files are canonical pre-push, DB is canonical post-push.
 *   - One transaction per post.
 *   - Idempotent: re-running with unchanged files is a no-op.
 *   - The post.id field is read from the EN file's frontmatter (UUID v7,
 *     scaffolded by `content:new`). Slug, title, summary, etc. are also
 *     authoritative from the EN file's frontmatter.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { S3Client } from '@aws-sdk/client-s3';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Locale } from '$lib/i18n/runtime';
import { isLocale } from '$lib/i18n/runtime';
import { renderBlogPost } from '$lib/server/blog/pipeline';
import { createId } from '$lib/server/db/id';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { domain, post, publishedRevision, revision } from '$lib/server/db/schema/blog';
import type { Database } from '$lib/server/db/types';
import { hasRelativeAssets, uploadReferencedAssets } from './assets';
import { localeFromFilename, type ParsedContentFile, parseContentFile } from './frontmatter';
import { contentHash } from './hash';
import type { PushAction, PushReport } from './types';

export interface PushOptions {
	/** Required: drizzle Database instance (CLI passes its own Pool-backed db; routes pass `$lib/server/db`). */
	db: Database;
	/** Optional: S3Client + bucket for relative-path asset uploads. If omitted and any locale references a relative path, push fails for that locale. */
	r2?: { s3: S3Client; bucket: string };
	/** Don't write to DB; print what would happen. */
	dryRun?: boolean;
	/** Override the system author lookup. */
	authorId?: string;
}

/** Walk `content/blog/` and return the slugs that have an `en.md` file. */
export async function listContentSlugs(domain: 'blog' = 'blog'): Promise<string[]> {
	const root = join(process.cwd(), 'content', domain);
	let entries: string[];
	try {
		entries = await readdir(root);
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw err;
	}
	const slugs: string[] = [];
	for (const slug of entries) {
		if (slug.startsWith('.')) continue;
		try {
			await readFile(join(root, slug, 'en.md'));
			slugs.push(slug);
		} catch {
			// Not a content directory or missing en.md; skip.
		}
	}
	return slugs.sort();
}

/** Locate the system author (by ADMIN_EMAIL env var) used as the revision author for file-pushed content. */
export async function getSystemAuthor(db: Database): Promise<string> {
	const adminEmail = process.env.ADMIN_EMAIL;
	if (!adminEmail) {
		throw new Error('ADMIN_EMAIL not set in environment — cannot determine push author');
	}
	const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, adminEmail.toLowerCase())).limit(1);
	if (!row) {
		throw new Error(`No user found with email ${adminEmail} — sign in once to create the user record`);
	}
	return row.id;
}

interface LoadedPost {
	slug: string;
	sourcePath: string;
	files: { locale: Locale; parsed: ParsedContentFile; absolutePath: string }[];
}

/** Read every locale file for a slug from disk into memory. */
export async function loadPost(slug: string, domain: 'blog' = 'blog'): Promise<LoadedPost> {
	const dir = join(process.cwd(), 'content', domain, slug);
	const entries = await readdir(dir);
	const files: LoadedPost['files'] = [];
	for (const entry of entries) {
		if (!entry.endsWith('.md')) continue;
		const locale = localeFromFilename(basename(entry));
		if (!locale) continue;
		const absolutePath = join(dir, entry);
		const text = await readFile(absolutePath, 'utf8');
		const parsed = parseContentFile(text, absolutePath);
		files.push({ locale, parsed, absolutePath });
	}
	const enFile = files.find((f) => f.locale === 'en');
	if (!enFile) {
		throw new Error(`${dir}: missing required en.md`);
	}
	const sourcePath = `content/${domain}/${slug}`;
	return { slug, sourcePath, files };
}

/**
 * Push one slug: ensure the post exists and create+publish a fresh revision
 * for every locale whose file hash differs from the latest published revision.
 */
export async function pushPost(slug: string, options: PushOptions): Promise<PushAction[]> {
	const { db } = options;
	const loaded = await loadPost(slug);
	const enFile = loaded.files.find((f) => f.locale === 'en');
	if (!enFile) throw new Error(`${slug}: en.md missing (loadPost should have caught this)`);

	const authorId = options.authorId ?? (await getSystemAuthor(db));
	const actions: PushAction[] = [];

	// Compute the EN hash up front — non-EN files' sourceContentHash should match it.
	const enHash = await contentHash(enFile.parsed.body);

	// Resolve domain by slug (if frontmatter declares one). Required for publishing.
	let domainId: string | null = null;
	if (enFile.parsed.frontmatter.domain) {
		const [d] = await db
			.select({ id: domain.id })
			.from(domain)
			.where(eq(domain.slug, enFile.parsed.frontmatter.domain))
			.limit(1);
		if (!d) {
			throw new Error(
				`${enFile.absolutePath}: domain '${enFile.parsed.frontmatter.domain}' not found in DB — create it via the admin UI first`,
			);
		}
		domainId = d.id;
	}

	// Ensure post row exists. Idempotent on (id) — multi-push is safe.
	if (!options.dryRun) {
		await db
			.insert(post)
			.values({
				id: enFile.parsed.frontmatter.id,
				slug: enFile.parsed.frontmatter.slug,
				authorId,
				sourcePath: loaded.sourcePath,
				status: enFile.parsed.frontmatter.status ?? 'draft',
				...(domainId && { domainId }),
			})
			.onConflictDoUpdate({
				target: post.id,
				set: {
					slug: enFile.parsed.frontmatter.slug,
					sourcePath: loaded.sourcePath,
					...(domainId && { domainId }),
					updatedAt: new Date(),
				},
			});
	}

	for (const file of loaded.files) {
		const ref = { id: enFile.parsed.frontmatter.id, slug: enFile.parsed.frontmatter.slug, locale: file.locale };

		try {
			// Asset upload pass: rewrite relative-path images to proxy URLs BEFORE hashing
			// (so subsequent re-pushes with no edits remain idempotent).
			let body = file.parsed.body;
			if (hasRelativeAssets(body)) {
				if (!options.r2) {
					throw new Error(`${file.absolutePath}: contains relative-path assets but no R2 client supplied`);
				}
				if (options.dryRun) {
					console.log(`[${ref.slug}/${ref.locale}] dry-run: would upload local assets to R2`);
				} else {
					const uploaded = await uploadReferencedAssets({
						db,
						s3: options.r2.s3,
						bucket: options.r2.bucket,
						postId: ref.id,
						authorId,
						postDir: join(loaded.sourcePath),
						markdown: body,
					});
					body = uploaded.rewritten;
					if (uploaded.uploaded.length > 0) {
						console.log(`[${ref.slug}/${ref.locale}] uploaded ${uploaded.uploaded.length} asset(s) to R2`);
					}
				}
			}

			const fileHash = file.locale === 'en' && body === file.parsed.body ? enHash : await contentHash(body);

			// Check latest revision for this (post, locale).
			const [latest] = await db
				.select({ id: revision.id, hash: revision.contentHash })
				.from(revision)
				.where(and(eq(revision.postId, ref.id), eq(revision.locale, file.locale)))
				.orderBy(sql`${revision.revisionNumber} DESC`)
				.limit(1);

			if (latest && latest.hash === fileHash) {
				// Revision is current; ensure it's the published one for this locale (idempotent).
				if (!options.dryRun && domainId) {
					const [pubRow] = await db
						.select({ revisionId: publishedRevision.revisionId })
						.from(publishedRevision)
						.where(and(eq(publishedRevision.postId, ref.id), eq(publishedRevision.locale, file.locale)))
						.limit(1);
					if (!pubRow || pubRow.revisionId !== latest.id) {
						await db
							.insert(publishedRevision)
							.values({ postId: ref.id, locale: file.locale, revisionId: latest.id })
							.onConflictDoUpdate({
								target: [publishedRevision.postId, publishedRevision.locale],
								set: { revisionId: latest.id },
							});
						await db
							.update(post)
							.set({
								status: 'published',
								publishedAt: sql`COALESCE(${post.publishedAt}, now())`,
								updatedAt: new Date(),
							})
							.where(eq(post.id, ref.id));
					}
				}
				actions.push({ kind: 'skipped', ref, reason: 'unchanged_hash' });
				continue;
			}

			if (options.dryRun) {
				actions.push(latest ? { kind: 'updated', ref, previousHash: latest.hash } : { kind: 'created', ref });
				continue;
			}

			// Render and create the revision in one transaction (mirrors createRevision behavior).
			const [hash, render] = await Promise.all([
				Promise.resolve(fileHash),
				renderBlogPost(body).catch((err) => {
					console.warn(`[content/push] render failed for ${ref.slug}/${file.locale}:`, err);
					return null;
				}),
			]);

			const revisionId = createId.revision();
			await db.transaction(async (tx) => {
				const [maxRow] = await tx
					.select({ maxNum: sql<number>`COALESCE(MAX(${revision.revisionNumber}), 0)` })
					.from(revision)
					.where(and(eq(revision.postId, ref.id), eq(revision.locale, file.locale)));

				await tx.insert(revision).values({
					id: revisionId,
					postId: ref.id,
					revisionNumber: (maxRow?.maxNum ?? 0) + 1,
					title: file.parsed.frontmatter.title,
					summary: file.parsed.frontmatter.summary ?? null,
					markdown: body,
					locale: file.locale,
					renderedHtml: render?.html ?? null,
					embedDescriptors: render?.embeds ?? null,
					contentHash: hash,
					sourceContentHash: file.locale === 'en' ? null : (file.parsed.frontmatter.sourceContentHash ?? null),
					translatedBy: file.locale === 'en' ? null : 'claude-code',
					authorId,
				});

				// UPSERT published_revision pointer for this locale (only if post has a domain).
				if (domainId) {
					await tx
						.insert(publishedRevision)
						.values({ postId: ref.id, locale: file.locale, revisionId })
						.onConflictDoUpdate({
							target: [publishedRevision.postId, publishedRevision.locale],
							set: { revisionId },
						});
					await tx
						.update(post)
						.set({
							status: 'published',
							publishedAt: sql`COALESCE(${post.publishedAt}, now())`,
							updatedAt: new Date(),
						})
						.where(eq(post.id, ref.id));
				} else {
					await tx.update(post).set({ updatedAt: new Date() }).where(eq(post.id, ref.id));
				}
			});

			actions.push(latest ? { kind: 'updated', ref, previousHash: latest.hash } : { kind: 'created', ref });
		} catch (err: unknown) {
			actions.push({
				kind: 'failed',
				ref,
				code: 'db_error',
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return actions;
}

/** Aggregate per-action results into a `PushReport`. */
export function summarizeActions(actions: PushAction[]): PushReport {
	const report: PushReport = { created: [], updated: [], skipped: [], failed: [] };
	for (const a of actions) {
		if (a.kind === 'created') report.created.push(a.ref);
		else if (a.kind === 'updated') report.updated.push(a.ref);
		else if (a.kind === 'skipped') report.skipped.push({ ref: a.ref, reason: a.reason });
		else report.failed.push({ ref: a.ref, code: a.code, message: a.message });
	}
	return report;
}

/** Find DB rows that claim a sourcePath whose file no longer exists on disk. */
export async function findOrphanedSourcePaths(
	db: Database,
): Promise<{ id: string; slug: string; sourcePath: string }[]> {
	const rows = await db
		.select({ id: post.id, slug: post.slug, sourcePath: post.sourcePath })
		.from(post)
		.where(and(isNull(post.deletedAt), sql`${post.sourcePath} IS NOT NULL`));
	const orphans: { id: string; slug: string; sourcePath: string }[] = [];
	for (const row of rows) {
		if (!row.sourcePath) continue;
		try {
			await readFile(join(process.cwd(), row.sourcePath, 'en.md'));
		} catch {
			orphans.push({ id: row.id, slug: row.slug, sourcePath: row.sourcePath });
		}
	}
	return orphans;
}

export { isLocale };
