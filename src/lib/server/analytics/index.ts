/**
 * The analytics domain's door for other domains.
 *
 * Deliberately small. The collector runs as a hook (`collector.hook.ts`) and is reached
 * by `hooks.server.ts` directly; the lanes' write chokepoints live in `db/analytics/`.
 * What other domains need from here is the buffered bot lane: the `jobs/` flush and the
 * admin page drain it, and the ranges job publishes the prefixes it verifies against.
 */

export { flushBotHits } from './bot-hit-buffer';
export { publishBotRanges } from './bot-ranges';
