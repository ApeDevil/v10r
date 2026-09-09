import type { PageServerLoad } from './$types';

/**
 * No server work: every demo on this page is about what the BROWSER does with the
 * wait, so measuring it server-side would measure the wrong thing.
 */
export const load: PageServerLoad = () => ({ title: 'Interaction - Velocity - Showcases' });
