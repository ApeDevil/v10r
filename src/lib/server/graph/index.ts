import { env } from '$env/dynamic/private';
import { GRAPH_TIMEOUT_MS } from '$lib/server/config';
import { classifyError, Neo4jError } from './errors';

/** Derive HTTPS host from NEO4J_URI (neo4j+s://xxx → https://xxx) */
function getHttpHost(): string {
	if (!env.NEO4J_URI) throw new Neo4jError('unavailable', 'NEO4J_URI is not set');
	return env.NEO4J_URI.replace(/^neo4j(\+s)?:\/\//, 'https://');
}

function getDatabase(): string {
	return env.NEO4J_DATABASE || 'neo4j';
}

/** Base64-encode Basic auth header (memoized — credentials don't change at runtime) */
let cachedAuthHeader: string | undefined;

function getAuthHeader(): string {
	if (cachedAuthHeader) return cachedAuthHeader;
	if (!env.NEO4J_USERNAME || !env.NEO4J_PASSWORD) {
		throw new Neo4jError('authentication', 'NEO4J_USERNAME or NEO4J_PASSWORD is not set');
	}
	cachedAuthHeader = `Basic ${btoa(`${env.NEO4J_USERNAME}:${env.NEO4J_PASSWORD}`)}`;
	return cachedAuthHeader;
}

interface Neo4jHttpResponse {
	data?: {
		fields: string[];
		values: unknown[][];
	};
	errors?: Array<{
		message: string;
		code: string;
	}>;
	counters?: Record<string, number>;
}

/**
 * Execute a Cypher statement via the Neo4j HTTP Query API.
 *
 * Returns an array of records mapped from columnar {fields, values} format.
 * Uses `Accept: application/json` so integers come as native JS numbers.
 */
export async function cypher<T = Record<string, unknown>>(
	statement: string,
	parameters?: Record<string, unknown>,
	options?: { timeoutMs?: number },
): Promise<T[]> {
	const host = getHttpHost();
	const url = `${host}/db/${getDatabase()}/query/v2`;
	const timeoutMs = options?.timeoutMs ?? GRAPH_TIMEOUT_MS;

	const body: Record<string, unknown> = { statement };
	if (parameters && Object.keys(parameters).length > 0) {
		body.parameters = parameters;
	}

	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				Authorization: getAuthHeader(),
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === 'TimeoutError') {
			throw new Neo4jError('timeout', `Query timed out after ${timeoutMs}ms`);
		}
		throw new Neo4jError('unavailable', err instanceof Error ? err.message : 'Failed to reach Neo4j');
	}

	if (response.status === 401 || response.status === 403) {
		throw new Neo4jError('authentication', 'Invalid Neo4j credentials');
	}

	if (!response.ok) {
		const text = await response.text().catch(() => 'No response body');
		throw new Neo4jError('http', `HTTP ${response.status}: ${text}`);
	}

	const result: Neo4jHttpResponse = await response.json();

	if (result.errors && result.errors.length > 0) {
		const err = result.errors[0];
		throw new Neo4jError(classifyError(err.code), err.message, err.code);
	}

	// No data means a write-only query (CREATE, DELETE, etc.)
	if (!result.data) return [];

	const { fields, values } = result.data;
	return values.map((row) => {
		const record: Record<string, unknown> = {};
		for (let i = 0; i < fields.length; i++) {
			record[fields[i]] = row[i];
		}
		return record as T;
	}) as T[];
}
