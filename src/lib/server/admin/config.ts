/**
 * Admin console policy — page sizes for the admin tables and the announcement cache TTL.
 */

/** Audit log entries per page */
export const AUDIT_PAGE_SIZE = 50;

/** Users per page in admin user management */
export const USERS_PAGE_SIZE = 25;

/** Announcement in-process cache TTL (ms) */
export const ANNOUNCEMENT_CACHE_TTL_MS = 30_000;

/** Delivery log entries per page in admin */
export const DELIVERY_PAGE_SIZE = 50;

/** AI conversations per page in admin */
export const AI_PAGE_SIZE = 25;

/** Retrieval documents per page in admin */
export const RETRIEVAL_PAGE_SIZE = 25;

/** Cache keys per page in admin */
export const CACHE_PAGE_SIZE = 50;

/** Blog posts per page in admin */
export const BLOG_PAGE_SIZE = 25;
