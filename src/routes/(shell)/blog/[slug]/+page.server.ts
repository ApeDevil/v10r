import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublishedPostForSlug } from '$lib/server/blog';

export const load: PageServerLoad = async ({ params }) => {
	const post = await getPublishedPostForSlug(params.slug);

	if (!post) {
		error(404, 'Post not found');
	}

	return { post };
};
