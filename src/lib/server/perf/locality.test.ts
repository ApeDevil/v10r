import { describe, expect, it } from 'vitest';
import { CRITICAL_PATH_HOPS, describeLocality, neonRegion, upstashRegion } from './locality';

// Synthetic hosts only. A test that needed a real connection string would be a test that
// put one in the repository.
const NEON = 'postgresql://user:pw@ep-cool-sun-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const NEON_POOLED = 'postgresql://user:pw@ep-cool-sun-123456-pooler.us-east-2.aws.neon.tech/neondb';

describe('neonRegion', () => {
	it('reads the region out of a direct and a pooled host', () => {
		expect(neonRegion(NEON)).toBe('eu-central-1');
		expect(neonRegion(NEON_POOLED)).toBe('us-east-2');
	});

	it('returns null rather than guessing', () => {
		expect(neonRegion(undefined)).toBeNull();
		expect(neonRegion('postgresql://user:pw@localhost:5432/v10r')).toBeNull();
	});
});

describe('upstashRegion', () => {
	it('reads the region prefix when the database has one', () => {
		expect(upstashRegion('https://eu2-smart-owl-12345.upstash.io')).toBe('eu2');
		expect(upstashRegion('https://us1-smart-owl-12345.upstash.io')).toBe('us1');
	});

	it('treats a prefixless host as unknown, not as regionless', () => {
		// Newer Upstash databases dropped the prefix. Reporting "no region" there would be
		// a false statement about the deployment; reporting null is a true one about us.
		expect(upstashRegion('https://smart-owl-12345.upstash.io')).toBeNull();
	});
});

describe('describeLocality', () => {
	it('reports every system, with or without a region', () => {
		const rows = describeLocality({
			NEON_DATABASE_URL_PROD: NEON,
			UPSTASH_REDIS_REST_URL: 'https://eu2-x-1.upstash.io',
		});

		expect(rows.map((r) => r.provider)).toEqual(['Vercel', 'Neon', 'Upstash Redis', 'Neo4j Aura', 'Cloudflare R2']);
		expect(rows.find((r) => r.provider === 'Neon')?.region).toBe('eu-central-1');
		expect(rows.find((r) => r.provider === 'Vercel')?.region).toBeNull();
	});

	it('never carries a credential into its output', () => {
		// The one property worth a test: this map is printed to terminals and pasted into
		// issues. Nothing that reached it may contain the secret it was derived from.
		const rows = describeLocality({
			NEON_DATABASE_URL_PROD: NEON,
			UPSTASH_REDIS_REST_URL: 'https://eu2-x-1.upstash.io',
		});

		expect(JSON.stringify(rows)).not.toContain('pw');
		expect(JSON.stringify(rows)).not.toContain('ep-cool-sun-123456');
		expect(JSON.stringify(rows)).not.toContain('upstash.io');
	});

	it('distinguishes a configured system with no derivable region from an absent one', () => {
		expect(describeLocality({ NEO4J_URI: 'neo4j+s://abc.databases.neo4j.io' })[3].source).toContain('not derivable');
		expect(describeLocality({})[3].source).toBe('not configured');
	});
});

describe('critical path hops', () => {
	it('names what the user waits for', () => {
		// The asset hop is the only non-blocking one, and it is non-blocking because the
		// browser fetches it directly. If a function ever proxies R2, this stops being true.
		expect(CRITICAL_PATH_HOPS.filter((h) => !h.blocking).map((h) => h.to)).toEqual(['R2']);
		expect(CRITICAL_PATH_HOPS.every((h) => h.note.length > 0)).toBe(true);
	});
});
