/**
 * Brand identity constants.
 *
 * The single source of truth for the product name. Used in:
 * - Root layout `<title>` (via `+layout.svelte` reading `page.data.title`)
 * - RSS feed channel title
 * - Anywhere else that legitimately needs the brand string
 *
 * Pages set their own per-page name via `page.data.title` from a load function;
 * the layout renders `${title} - ${BRAND_NAME}`, falling back to `BRAND_NAME` alone.
 */
export const BRAND_NAME = 'V10r';
