import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';

const ALLOWED_LOCALES = new Set(['en', 'de', 'fr']);

export const handle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		const safeLocale = ALLOWED_LOCALES.has(locale) ? locale : 'en';
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', safeLocale)
		});
	});
