import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, status, message }) => {
	console.error('[client]', { status, message, error });

	return { message };
};
