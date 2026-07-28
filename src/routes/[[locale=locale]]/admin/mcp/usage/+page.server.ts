import { requireAdmin } from '$lib/server/auth/guards';
import {
	countSuppressedGaps,
	GAP_MIN_DISTINCT_CLIENTS,
	getCapabilityGaps,
	getClientBreakdown,
	getHealthSummary,
	getLatency,
	getStageVolume,
	getToolBreakdown,
	getUnsupportedVersionRequests,
	type McpWindow,
	telemetryReachable,
	windowStart,
} from '$lib/server/mcp/telemetry/queries';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

const WINDOWS = ['24h', '7d', '30d'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);

	const requested = url.searchParams.get('window');
	const window: McpWindow = (WINDOWS as readonly string[]).includes(requested ?? '') ? (requested as McpWindow) : '7d';
	const since = windowStart(window);

	/**
	 * Distinguish "the table is not provisioned" from "nobody has called the MCP".
	 *
	 * Without this probe the two are identical on screen — an empty dashboard — and the telemetry
	 * design's own safety properties conspire to hide the difference: the writer returns void,
	 * swallows its errors, and races a deadline, so a missing table produces silent total loss with
	 * a green test suite. "Nobody used it" is the wrong conclusion to reach by accident.
	 */
	if (!(await telemetryReachable())) {
		return { title: 'MCP Usage', window, unavailable: true as const };
	}

	// Cheap grouped aggregates over an indexed window — awaited so the page has real content at TTFB.
	const [health, tools, stages, latency] = await Promise.all([
		getHealthSummary(since),
		getToolBreakdown(since),
		getStageVolume(since),
		getLatency(since),
	]);

	return {
		title: 'MCP Usage',
		window,
		unavailable: false as const,
		minDistinctClients: GAP_MIN_DISTINCT_CLIENTS,
		health,
		tools,
		stages,
		latency,
		// Deferred: these scan the raw log rather than a grouped index range, and the gaps query is
		// the one that touches retained third-party text — worth keeping off the critical path.
		gaps: safeDeferPromise(getCapabilityGaps(since), []),
		suppressedGaps: safeDeferPromise(countSuppressedGaps(since), 0),
		clients: safeDeferPromise(getClientBreakdown(since), []),
		unsupportedVersions: safeDeferPromise(getUnsupportedVersionRequests(since), []),
	};
};
