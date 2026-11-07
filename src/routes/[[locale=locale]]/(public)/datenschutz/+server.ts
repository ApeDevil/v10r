import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * The privacy policy shipped at /datenschutz for a few hours on 2026-11-07 before it
 * moved to /privacy, in line with the site's English paths. Links shared in that
 * window keep working; the locale prefix is kept.
 */
export const GET: RequestHandler = ({ url }) => {
	redirect(308, url.pathname.replace(/\/datenschutz\/?$/, '/privacy'));
};
