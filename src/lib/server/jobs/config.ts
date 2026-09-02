/**
 * Scheduler cadence. Individual job windows live with their own policy; retention windows
 * live in `retention/schedule.ts`.
 */

/** Default scheduler interval (3 hours, ms). Override with JOB_INTERVAL_MS env var. */
export const DEFAULT_JOB_INTERVAL_MS = 3 * 60 * 60 * 1000;

/** Delay before first scheduler run (ms) */
export const JOB_STARTUP_DELAY_MS = 5_000;
