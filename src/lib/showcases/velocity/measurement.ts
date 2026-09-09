/**
 * The wire contract for a Velocity measurement.
 *
 * Client-side because the showcase page renders these and a `.svelte` file may never
 * reach into `$lib/server/` — the path IS the server/client boundary, and a type-only
 * import still crosses it in the source. The server module that produces these
 * imports the shape from here, so there is one declaration rather than two that drift.
 */
export const VELOCITY_MEASUREMENT_IDS = [
	'waterfall',
	'cache',
	'swr',
	'stampede',
	'tail',
	'breaker',
	'bulkhead',
	'deadline',
] as const;
export type VelocityMeasurementId = (typeof VELOCITY_MEASUREMENT_IDS)[number];

export function isVelocityMeasurementId(value: unknown): value is VelocityMeasurementId {
	return typeof value === 'string' && (VELOCITY_MEASUREMENT_IDS as readonly string[]).includes(value);
}

export interface MeasurementArm {
	label: string;
	/** Wall-clock milliseconds this arm took. */
	ms: number;
	/** Times the simulated dependency actually ran during this arm. */
	originCalls: number;
}

export interface VelocityMeasurement {
	id: VelocityMeasurementId;
	/** Spans the tracer recorded while running it, as `Server-Timing` renders them. */
	spans?: Array<{ name: string; ms: number }>;
	naive: MeasurementArm;
	velocity: MeasurementArm;
	/** Facts the two numbers do not carry on their own, including the caveats. */
	detail: string[];
}
