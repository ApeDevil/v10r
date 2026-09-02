/**
 * Image ingest policy — accepted input types and the bounds applied before any vision call.
 */

/** Max original image upload size (bytes, 8 MB) — server-proxied; rejected before processing. */
export const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;

/** Longest edge of the stored derivative (px). Strips EXIF + bounds vision token cost. */
export const MAX_DIMENSION = 1024;

/** Accepted image input types (sniffed by magic bytes, not just the declared MIME). */
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
