/**
 * Did a target check start the service process? True when the process is younger than the
 * check itself (plus a second of slack for rounding): the request arrived to find no
 * running process, which on an idling free host means a cold start. Read from the
 * service's own `uptimeMs`, so it is observed, not inferred from latency.
 *
 * Shared by the lab page and `scripts/external-service/verify.ts`, so both apply one rule.
 */
export function startedDuringCheck(uptimeMs: number, checkElapsedMs: number): boolean {
	return uptimeMs < checkElapsedMs + 1_000;
}
