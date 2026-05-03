/**
 * Seed one demo blog post with all 3 locale revisions to prove the
 * row-per-locale pattern. Skips silently if no users exist yet.
 * Idempotent.
 */
import { createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { user } from '../schema/auth/_better-auth';
import { domain, post } from '../schema/blog/post';
import { publishedRevision } from '../schema/blog/published-revision';
import { revision } from '../schema/blog/revision';
import type { SeedDb } from './index';

const SEED_SLUG = 'i18n-stance-c-demo';
const SEED_POST_ID = 'pst_seed_i18n_demo';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export async function seedBlogRevisions(db: SeedDb) {
	const firstUser = await db.select({ id: user.id }).from(user).limit(1);
	if (firstUser.length === 0) {
		console.log('[seed] no users yet — skipping blog revisions');
		return;
	}
	const authorId = firstUser[0].id;

	const eng = await db.select({ id: domain.id }).from(domain).where(eq(domain.slug, 'engineering')).limit(1);
	const domainId = eng[0]?.id ?? null;

	const existing = await db
		.select({ id: post.id })
		.from(post)
		.where(and(eq(post.slug, SEED_SLUG), isNull(post.deletedAt)))
		.limit(1);

	let postId: string;
	if (existing.length > 0) {
		postId = existing[0].id;
		await db
			.update(post)
			.set({ authorId, domainId, status: 'published', publishedAt: sql`now()`, updatedAt: sql`now()` })
			.where(eq(post.id, postId));
	} else {
		postId = SEED_POST_ID;
		await db.insert(post).values({
			id: postId,
			slug: SEED_SLUG,
			authorId,
			domainId,
			status: 'published',
			publishedAt: sql`now()`,
		});
	}

	const revisions = [
		{
			locale: 'en',
			title: 'Stance C: full coverage end to end',
			summary: 'How v10r proves it translates content, not just chrome.',
			markdown:
				'# Stance C\n\nThis post exists in English, German, and Russian. The reader UI selects the right revision row by locale.',
		},
		{
			locale: 'de',
			title: 'Stance C: vollständige Abdeckung von Anfang bis Ende',
			summary: 'Wie v10r beweist, dass Inhalte übersetzt werden, nicht nur die Oberfläche.',
			markdown:
				'# Stance C\n\nDieser Beitrag existiert auf Englisch, Deutsch und Russisch. Die Lese-Oberfläche wählt die passende Revision anhand der Sprache.',
		},
		{
			locale: 'ru',
			title: 'Stance C: полное покрытие от начала до конца',
			summary: 'Как v10r показывает, что переводится контент, а не только интерфейс.',
			markdown:
				'# Stance C\n\nЭтот пост существует на английском, немецком и русском. Интерфейс читателя выбирает нужную ревизию по локали.',
		},
	];

	for (const r of revisions) {
		const revId = `rev_seed_i18n_demo_${r.locale}`;
		await db
			.insert(revision)
			.values({
				id: revId,
				postId,
				revisionNumber: 1,
				title: r.title,
				summary: r.summary,
				markdown: r.markdown,
				locale: r.locale,
				contentHash: hash(r.markdown),
				authorId,
			})
			.onConflictDoUpdate({
				target: revision.id,
				set: {
					title: r.title,
					summary: r.summary,
					markdown: r.markdown,
					contentHash: hash(r.markdown),
				},
			});

		await db
			.insert(publishedRevision)
			.values({ postId, locale: r.locale, revisionId: revId })
			.onConflictDoUpdate({
				target: [publishedRevision.postId, publishedRevision.locale],
				set: { revisionId: revId },
			});
	}
}
