// ── Types ────────────────────────────────────────────────────────────────────

export type ThresholdLevel = 'ok' | 'warning' | 'error';

export type ProviderStatus = 'ok' | 'unavailable' | 'error';

export interface ProviderResult<T> {
	status: ProviderStatus;
	data: T | null;
	error: string | null;
	measuredAt: string;
	latencyMs: number;
}

export interface NeonTableInfo {
	schema: string;
	table: string;
	totalBytes: number;
	tableBytes: number;
	indexBytes: number;
	liveRows: number;
	deadRows: number;
	lastAutovacuum: string | null;
	lastAutoanalyze: string | null;
}

export interface NeonMetrics {
	totalBytes: number;
	limitBytes: number;
	percentage: number;
	threshold: ThresholdLevel;
	tables: NeonTableInfo[];
}

export interface Neo4jMetrics {
	nodeCount: number;
	relCount: number;
	nodeLimit: number;
	relLimit: number;
	nodePercentage: number;
	relPercentage: number;
	nodeThreshold: ThresholdLevel;
	relThreshold: ThresholdLevel;
	labels: Array<{ label: string; count: number }>;
	relTypes: Array<{ type: string; count: number }>;
}

export interface UpstashMetrics {
	commandsUsed: number;
	commandsLimit: number;
	commandsPercentage: number;
	commandsThreshold: ThresholdLevel;
	storageBytes: number;
	storageLimit: number;
	storagePercentage: number;
	storageThreshold: ThresholdLevel;
}

export interface R2Metrics {
	storageBytes: number;
	storageLimit: number;
	storagePercentage: number;
	storageThreshold: ThresholdLevel;
	objectCount: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const FREE_TIER_LIMITS = {
	neon: { storageBytes: 512 * 1024 * 1024 },
	neo4j: { nodes: 200_000, relationships: 400_000 },
	upstash: { storageBytes: 256 * 1024 * 1024, commands: 500_000 },
	r2: { storageBytes: 10 * 1024 * 1024 * 1024, reads: 10_000_000, writes: 1_000_000 },
} as const;

export const THRESHOLDS = { warning: 0.7, error: 0.9 } as const;

// ── Utilities ────────────────────────────────────────────────────────────────

export function computeThreshold(used: number, limit: number): ThresholdLevel {
	const ratio = limit > 0 ? used / limit : 0;
	if (ratio >= THRESHOLDS.error) return 'error';
	if (ratio >= THRESHOLDS.warning) return 'warning';
	return 'ok';
}

export function computePercentage(used: number, limit: number): number {
	if (limit <= 0) return 0;
	return Math.round((used / limit) * 1000) / 10;
}

export function sanitizeError(err: unknown): string {
	if (!(err instanceof Error)) return 'Unknown error';
	return err.message
		.replace(/postgres(ql)?:\/\/[^\s]+/gi, '[redacted]')
		.replace(/https?:\/\/[^\s]*(?:key|token|secret|password|auth)[^\s]*/gi, '[redacted]')
		.replace(/\b[A-Za-z0-9+/=]{40,}\b/g, '[redacted]');
}
