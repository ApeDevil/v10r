import { error } from '@sveltejs/kit';
import { tc } from '$lib/i18n/content';
import { getPublishedPostForSlug } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const locale = locals.locale;

	// Try the requested locale first.
	const localized = await getPublishedPostForSlug(params.slug, locale);

	// Hard-404 for non-EN: if no revision exists in the user's locale, the
	// localized URL doesn't exist. EN is canonical and never 404s on missing
	// translation.
	if (!localized && locale !== 'en') {
		error(404, 'Post not available in this language');
	}

	const post = localized ?? (locale === 'en' ? null : await getPublishedPostForSlug(params.slug, 'en'));
	if (!post) {
		error(404, 'Post not found');
	}

	// Resolve translatable tag/domain names (post.revision is already locale-correct)
	const tags = post.tags.map((t) => ({ ...t, name: tc(t.name, t.nameI18n, locale) }));

	return {
		title: post.revision.title,
		post: { ...post, tags },
	};
};
