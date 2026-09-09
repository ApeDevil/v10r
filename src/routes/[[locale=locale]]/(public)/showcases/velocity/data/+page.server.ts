import { EXPIRY_WAIT_MS, ORIGIN_MS, STAMPEDE_CALLERS } from '$lib/server/showcases/velocity';
import type { PageServerLoad } from './$types';

/**
 * Deliberately measures nothing.
 *
 * Every demo on this page spends a few hundred milliseconds of real sleeping, and a
 * page about latency that makes you wait a second for its own first byte would be
 * arguing against itself. The load hands over the constants; the measurements run
 * when the visitor asks, through `POST /api/showcases/velocity`.
 */
export const load: PageServerLoad = () => ({
	title: 'Data - Velocity - Showcases',
	originMs: ORIGIN_MS,
	stampedeCallers: STAMPEDE_CALLERS,
	expiryWaitMs: EXPIRY_WAIT_MS,
});
