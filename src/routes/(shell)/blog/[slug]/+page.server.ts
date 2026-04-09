import { error } from '@sveltejs/kit';
import { getPublishedPostForSlug } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const post = await getPublishedPostForSlug(params.slug);

	if (!post) {
		error(404, 'Post not found');
	}

	return { post };
};
