import { ORIGIN_MS, STAMPEDE_CALLERS } from '$lib/server/showcases/velocity';
import type { PageServerLoad } from './$types';

/**
 * Nothing measured here. The overview explains the ladder and hands the two demo
 * pages the constants they quote, so the prose and the measurements cannot drift
 * apart — a page that says "~60ms" beside a demo that uses 80 is worse than a page
 * that says nothing.
 */
export const load: PageServerLoad = () => ({
	title: 'Velocity - Showcases',
	originMs: ORIGIN_MS,
	stampedeCallers: STAMPEDE_CALLERS,
});
