import type { HandleClientError } from '@sveltejs/kit/hooks';

/**
 * SvelteKit 3 passes every client-side navigation error here with its `kind`, including the
 * ones thrown on purpose with `error()` (`app`), which SvelteKit 2 never sent. Those are pages
 * the user is meant to see, so they stay out of the console; everything else is logged, as
 * before. Returning nothing keeps SvelteKit's status and message.
 */
export const handleError: HandleClientError = ({ kind, error }) => {
	if (kind !== 'app') console.error('[client]', { kind, error });
};
