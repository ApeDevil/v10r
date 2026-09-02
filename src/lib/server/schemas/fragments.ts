/** Shared Valibot schema fragments reused across domain modules. */
import * as v from 'valibot';

/**
 * Slug shape: lowercase alphanumerics and inner hyphens, never leading or trailing.
 *
 * The DATABASE is the authority — `blog.post`, `blog.domain` and `blog.tag` each carry a
 * `check()` with this pattern, so a bad slug cannot be stored no matter which path writes
 * it. This constant is the application-side copy that lets a form reject one early with a
 * useful message instead of surfacing a constraint violation. Keep the two in step; do not
 * add a third.
 */
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const SlugParam = v.pipe(v.string(), v.minLength(1), v.maxLength(200), v.regex(SLUG_PATTERN));

export const Markdown = v.pipe(v.string(), v.minLength(1));

export const LocaleParam = v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(10)), 'en');
