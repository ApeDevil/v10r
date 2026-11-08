/**
 * Ten example workloads for Explore — profiles only. The engine derives every recommendation
 * from them; nothing here states an answer, so an example can never disagree with the rules.
 *
 * Not called "scenarios": in v10r a scenario is one adverse condition measured by
 * `perf/scenarios.ts` (`docs/naming.md`).
 */
import { UNKNOWN, type WorkloadProfile } from './vocabulary.ts';

export interface WorkloadExample {
	id: string;
	title: string;
	summary: string;
	profile: WorkloadProfile;
}

export const WORKLOAD_EXAMPLES: readonly WorkloadExample[] = [
	{
		id: 'local-image-processing',
		title: 'Process images locally in the browser',
		summary: 'Filters applied to a photo the user just picked, previewed live, never uploaded.',
		profile: {
			workload: 'media-processing',
			duration: 'under-1s',
			dataVolume: 'medium',
			dataOrigin: 'user-device',
			sensitivity: 'personal',
			offline: 'not-required',
			latency: 'interactive',
			compute: 'heavy',
			background: 'not-required',
			infrastructure: 'serverless-only',
			complexityTolerance: 'medium',
		},
	},
	{
		id: 'numerical-calculation',
		title: 'Perform an expensive numerical calculation',
		summary: 'A pricing or engineering calculation over parameters the user edits in a form.',
		profile: {
			workload: 'numeric-compute',
			duration: 'under-1s',
			dataVolume: 'small',
			dataOrigin: 'user-device',
			sensitivity: 'public',
			offline: 'not-required',
			latency: 'responsive',
			compute: 'moderate',
			background: 'not-required',
			infrastructure: 'serverless-only',
			complexityTolerance: 'low',
		},
	},
	{
		id: 'aggregate-large-dataset',
		title: 'Query and aggregate a large dataset',
		summary: 'A dashboard summing and grouping millions of rows that live in Postgres.',
		profile: {
			workload: 'data-query',
			duration: 'under-1s',
			dataVolume: 'large',
			dataOrigin: 'server-database',
			sensitivity: 'personal',
			offline: 'not-required',
			latency: 'responsive',
			compute: 'moderate',
			background: 'not-required',
			infrastructure: 'serverless-only',
			complexityTolerance: 'low',
		},
	},
	{
		id: 'background-media-conversion',
		title: 'Convert media in the background',
		summary: 'Uploaded videos transcoded into several formats; the user is told when it is done.',
		profile: {
			workload: 'media-processing',
			duration: 'minutes',
			dataVolume: 'large',
			dataOrigin: 'object-storage',
			sensitivity: 'personal',
			offline: 'not-required',
			latency: 'relaxed',
			compute: 'heavy',
			background: 'required',
			infrastructure: 'container-available',
			complexityTolerance: 'medium',
		},
	},
	{
		id: 'auth-and-business-rules',
		title: 'Implement authentication and business rules',
		summary: 'Sign-in, permissions, and the rules that decide what a user may change.',
		profile: {
			workload: 'business-rules',
			duration: 'under-100ms',
			dataVolume: 'small',
			dataOrigin: 'server-database',
			sensitivity: 'secret',
			offline: 'not-required',
			latency: 'interactive',
			compute: 'light',
			background: 'not-required',
			infrastructure: 'serverless-only',
			complexityTolerance: 'low',
		},
	},
	{
		id: 'realtime-collaboration',
		title: 'Provide real-time collaboration',
		summary: 'Several people editing one board and seeing each other’s changes live.',
		profile: {
			workload: 'realtime-collaboration',
			duration: 'under-100ms',
			dataVolume: 'small',
			dataOrigin: 'server-database',
			sensitivity: 'personal',
			offline: 'not-required',
			latency: 'interactive',
			compute: 'light',
			background: 'not-required',
			infrastructure: UNKNOWN,
			complexityTolerance: 'medium',
		},
	},
	{
		id: 'long-running-simulation',
		title: 'Execute a long-running simulation',
		summary: 'A simulation that runs for an hour on server data and reports a result.',
		profile: {
			workload: 'simulation',
			duration: 'hours',
			dataVolume: 'medium',
			dataOrigin: 'server-database',
			sensitivity: 'public',
			offline: 'not-required',
			latency: 'relaxed',
			compute: 'heavy',
			background: 'required',
			infrastructure: 'container-available',
			complexityTolerance: 'high',
		},
	},
	{
		id: 'lightweight-rest-api',
		title: 'Serve a lightweight REST API',
		summary: 'A small JSON API other apps call to read a catalogue.',
		profile: {
			workload: 'light-api',
			duration: 'under-100ms',
			dataVolume: 'small',
			dataOrigin: 'server-database',
			sensitivity: 'public',
			offline: 'not-required',
			latency: 'interactive',
			compute: 'light',
			background: 'not-required',
			infrastructure: 'serverless-only',
			complexityTolerance: 'low',
		},
	},
	{
		id: 'large-file-uploads',
		title: 'Process large file uploads',
		summary: 'Users upload multi-gigabyte files that are checked and catalogued afterwards.',
		profile: {
			workload: 'file-ingest',
			duration: 'seconds',
			dataVolume: 'large',
			dataOrigin: 'user-device',
			sensitivity: 'personal',
			offline: 'not-required',
			latency: 'relaxed',
			compute: 'light',
			background: UNKNOWN,
			infrastructure: 'serverless-only',
			complexityTolerance: 'medium',
		},
	},
	{
		id: 'scale-heavy-backend',
		title: 'Scale a computation-heavy backend',
		summary: 'A backend calculation over stored data that has outgrown the app’s request budget.',
		profile: {
			workload: 'numeric-compute',
			duration: 'seconds',
			dataVolume: 'medium',
			dataOrigin: 'server-database',
			sensitivity: 'personal',
			offline: 'not-required',
			latency: 'responsive',
			compute: 'heavy',
			background: 'not-required',
			infrastructure: 'container-available',
			complexityTolerance: 'high',
		},
	},
];

export function findWorkloadExample(id: string): WorkloadExample | undefined {
	return WORKLOAD_EXAMPLES.find((example) => example.id === id);
}
