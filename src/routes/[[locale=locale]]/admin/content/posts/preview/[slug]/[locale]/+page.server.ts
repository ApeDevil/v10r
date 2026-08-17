import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { isLocale, locales } from '$lib/i18n/runtime';
import { renderBlogPost } from '$lib/server/blog/pipeline';
import { contentHash, getPreviewDrift, parseContentFile } from '$lib/server/content';
import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

/**
 * File-as-source preview. Reads `content/blog/<slug>/<locale>.md` from disk,
 * runs it through the same `renderBlogPost` pipeline production uses, and
 * returns a drift status comparing the file's hash against the latest
 * published revision in the DB.
 *
 * Auth is inherited from `src/routes/[[locale=locale]]/admin/+layout.server.ts` (requireAdmin).
 */
export const load: PageServerLoad = async ({ params }) => {
	const { slug, locale } = params;

	if (!isLocale(locale)) {
		error(404, `unsupported locale: ${locale}`);
	}

	const path = join(process.cwd(), 'content', 'blog', slug, `${locale}.md`);
	let raw: string;
	try {
		raw = await readFile(path, 'utf8');
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			error(404, `${slug}/${locale}.md not found`);
		}
		throw err;
	}

	const parsed = parseContentFile(raw, path);
	const fileHash = await contentHash(parsed.body);
	const [render, drift] = await Promise.all([renderBlogPost(parsed.body), getPreviewDrift(db, slug, locale, fileHash)]);

	return {
		slug,
		locale,
		frontmatter: parsed.frontmatter,
		fileHash,
		html: render.html,
		embeds: render.embeds,
		toc: render.toc,
		drift,
		supportedLocales: locales,
	};
};
