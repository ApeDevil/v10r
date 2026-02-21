/**
 * Seed script for the PostgreSQL Type System showcase.
 *
 * Run from inside the container:
 *   bun run scripts/seed-showcase.ts
 *
 * Uses process.env.DATABASE_URL directly (not $env — this runs outside SvelteKit).
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set. Check your .env file.');
	process.exit(1);
}

const client = neon(DATABASE_URL);
const db = drizzle(client);

async function seed() {
	console.log('Seeding showcase schema...\n');

	// 1. Create schema
	await db.execute(sql`CREATE SCHEMA IF NOT EXISTS showcase`);
	console.log('  [ok] Schema created');

	// 2. Seed type_specimen (numeric, text, boolean, UUID — mutable CRUD)
	await db.execute(sql`
		INSERT INTO showcase.type_specimen
			(label, code, country_code, rating, quantity, view_count,
			 price, temperature, latitude, longitude, is_active)
		VALUES
			('Svelte Framework',     'SVLT-001', 'US', 5, 42,    1500000, '0.00',       22.5,   37.7749,  -122.4194, true),
			('PostgreSQL Database',   'PGSQ-002', 'CA', 5, 100,   9200000, '9999.99',   -40.0,  45.4215,  -75.6972,  true),
			('Drizzle ORM',          'DRZL-003', 'DE', 4, 0,     350000,  '150.50',     98.6,   52.5200,  13.4050,   true),
			('Neon Serverless',      'NEON-004', 'JP', 4, 7,     420000,  NULL,         NULL,   35.6762,  139.6503,  true),
			('Inactive Feature',     'INAC-005', NULL, 1, 0,     12,      '0.01',       0.0,    0.0,      0.0,       false),
			('Edge Case: Max Int',   'MAXI-006', 'GB', 5, 2147483647, 0, '99999999.99', -273.15, 90.0,   180.0,     true),
			('Edge Case: Min Values','MINV-007', 'AU', 1, 0,     0,       '0.00',       -273.15, -90.0,  -180.0,    true)
		ON CONFLICT (code) DO NOTHING
	`);
	console.log('  [ok] type_specimen seeded (7 rows)');

	// 3. Seed type_specimen_history (versioned records)
	await db.execute(sql`
		INSERT INTO showcase.type_specimen_history
			(specimen_id, version, label, code, rating, quantity, price, is_active, changed_by, change_type)
		VALUES
			(1, 1, 'Svelte Framework', 'SVLT-001', 4, 30, '0.00', true, 'seed', 'create'),
			(1, 2, 'Svelte Framework', 'SVLT-001', 5, 42, '0.00', true, 'admin', 'update'),
			(2, 1, 'PostgreSQL Database', 'PGSQ-002', 5, 80, '9999.99', true, 'seed', 'create'),
			(2, 2, 'PostgreSQL Database', 'PGSQ-002', 5, 100, '9999.99', true, 'system', 'update'),
			(3, 1, 'Drizzle ORM', 'DRZL-003', 3, 0, '100.00', true, 'seed', 'create'),
			(3, 2, 'Drizzle ORM', 'DRZL-003', 4, 0, '150.50', true, 'admin', 'update')
		ON CONFLICT DO NOTHING
	`);
	console.log('  [ok] type_specimen_history seeded (6 rows)');

	// 4. Seed temporal_record (date/time types + temporal pattern)
	await db.execute(sql`
		INSERT INTO showcase.temporal_record
			(description, event_date, event_time, local_timestamp, utc_timestamp, duration, valid_from, valid_to)
		VALUES
			('Project kickoff',
			 '2024-01-15', '09:00:00', '2024-01-15 09:00:00', '2024-01-15 09:00:00+00',
			 '2 hours', '2024-01-15T00:00:00Z', NULL),
			('Sprint 1 retrospective',
			 '2024-01-29', '14:30:00', '2024-01-29 14:30:00', '2024-01-29 14:30:00+00',
			 '1 hour 30 minutes', '2024-01-29T00:00:00Z', '2024-02-12T00:00:00Z'),
			('Database migration window',
			 '2024-03-01', '02:00:00', '2024-03-01 02:00:00', '2024-03-01 02:00:00+00',
			 '4 hours', '2024-03-01T02:00:00Z', '2024-03-01T06:00:00Z'),
			('Year-long subscription',
			 '2024-01-01', '00:00:00', '2024-01-01 00:00:00', '2024-01-01 00:00:00+00',
			 '1 year', '2024-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
			('Interval arithmetic demo',
			 '2024-06-15', '12:00:00', '2024-06-15 12:00:00', '2024-06-15 12:00:00+00',
			 '2 years 3 months 4 days 5 hours', '2024-06-15T12:00:00Z', NULL)
		ON CONFLICT DO NOTHING
	`);
	console.log('  [ok] temporal_record seeded (5 rows)');

	// 5. Seed document_vault (JSON/JSONB + soft delete)
	await db.execute(sql`
		INSERT INTO showcase.document_vault (title, raw_json, metadata, settings, deleted_at)
		VALUES
			('Getting Started Guide',
			 '{"version": 1, "format": "markdown"}',
			 '{"category": "documentation", "tags": ["beginner", "setup"], "nested": {"level": 1, "description": "Entry-level guide"}}',
			 '{"theme": "light", "fontSize": 14}',
			 NULL),
			('API Reference',
			 '{ "version" : 2 ,  "format":"openapi" }',
			 '{"category": "documentation", "tags": ["api", "reference", "advanced"], "nested": {"level": 3, "description": "Complete API docs"}}',
			 '{"theme": "dark", "fontSize": 12, "showLineNumbers": true}',
			 NULL),
			('Deployment Checklist',
			 '{"version": 1, "format": "checklist"}',
			 '{"category": "operations", "tags": ["deployment", "devops"], "nested": {"level": 2, "description": "Pre-deploy verification"}}',
			 '{"autoSave": true}',
			 NULL),
			('Old Migration Guide (deleted)',
			 '{"version": 0, "deprecated": true}',
			 '{"category": "documentation", "tags": ["migration", "deprecated"], "nested": {"level": 1, "description": "Superseded by v2"}}',
			 '{}',
			 '2024-06-01T00:00:00Z'),
			('Draft: Security Audit',
			 NULL,
			 '{"category": "security", "tags": ["audit", "compliance"], "nested": {"level": 4, "description": "Annual security review"}}',
			 NULL,
			 NULL)
		ON CONFLICT DO NOTHING
	`);
	console.log('  [ok] document_vault seeded (5 rows)');

	// 6. Seed collection_shelf (arrays)
	await db.execute(sql`
		INSERT INTO showcase.collection_shelf (name, scores, tags, steps)
		VALUES
			('Frontend Stack',
			 ARRAY[95, 88, 72, 100, 91],
			 ARRAY['svelte', 'typescript', 'unocss', 'bits-ui'],
			 ARRAY['{"step": 1, "action": "Install dependencies"}'::jsonb,
			       '{"step": 2, "action": "Configure build tool"}'::jsonb,
			       '{"step": 3, "action": "Write first component"}'::jsonb]),
			('Backend Stack',
			 ARRAY[90, 85, 95, 78],
			 ARRAY['postgresql', 'drizzle', 'sveltekit', 'bun'],
			 ARRAY['{"step": 1, "action": "Set up database"}'::jsonb,
			       '{"step": 2, "action": "Define schema"}'::jsonb]),
			('Empty Collection',
			 ARRAY[]::integer[],
			 ARRAY[]::text[],
			 NULL),
			('Overlapping Tags',
			 ARRAY[100, 100, 100],
			 ARRAY['svelte', 'postgresql', 'shared-tag'],
			 NULL),
			('Single Element',
			 ARRAY[42],
			 ARRAY['solo'],
			 ARRAY['{"step": 1, "action": "Only step"}'::jsonb])
		ON CONFLICT DO NOTHING
	`);
	console.log('  [ok] collection_shelf seeded (5 rows)');

	// 7. Seed network_registry (inet, cidr, macaddr, point — immutable)
	await db.execute(sql`
		INSERT INTO showcase.network_registry
			(device_name, ip_address, network_block, mac_address, location)
		VALUES
			('Web Server (Primary)',   '192.168.1.10',  '192.168.1.0/24',  '08:00:2b:01:02:03', point(37.7749, -122.4194)),
			('Web Server (Secondary)', '192.168.1.11',  '192.168.1.0/24',  '08:00:2b:01:02:04', point(37.7750, -122.4195)),
			('Database Server',        '10.0.0.5',      '10.0.0.0/8',      'a4:83:e7:2d:6b:01', point(45.4215, -75.6972)),
			('IPv6 Gateway',           '::1',           '::1/128',         NULL,                 NULL),
			('Load Balancer',          '172.16.0.1',    '172.16.0.0/12',   'de:ad:be:ef:ca:fe',  point(52.5200, 13.4050)),
			('Edge Node (Tokyo)',      '203.0.113.42',  '203.0.113.0/24',  '00:1a:2b:3c:4d:5e',  point(35.6762, 139.6503)),
			('Monitoring Agent',       '192.168.1.100', '192.168.1.0/24',  '08:00:2b:ff:ff:ff',  point(37.7749, -122.4194))
		ON CONFLICT DO NOTHING
	`);
	console.log('  [ok] network_registry seeded (7 rows)');

	// 8. Seed range_booking (int4range, tstzrange, daterange)
	await db.execute(sql`
		INSERT INTO showcase.range_booking
			(resource_name, floor_range, booking_period, reservation_dates, priority)
		VALUES
			('Conference Room A',
			 '[1, 3)'::int4range,
			 '[2024-03-15 09:00:00+00, 2024-03-15 11:00:00+00)'::tstzrange,
			 '[2024-03-15, 2024-03-16)'::daterange, 8),
			('Conference Room A',
			 '[1, 3)'::int4range,
			 '[2024-03-15 13:00:00+00, 2024-03-15 15:00:00+00)'::tstzrange,
			 '[2024-03-15, 2024-03-16)'::daterange, 5),
			('Server Rack B',
			 '[10, 20)'::int4range,
			 '[2024-03-01 00:00:00+00, 2024-04-01 00:00:00+00)'::tstzrange,
			 '[2024-03-01, 2024-04-01)'::daterange, 10),
			('Parking Spot 42',
			 NULL,
			 '[2024-03-15 08:00:00+00, 2024-03-15 18:00:00+00)'::tstzrange,
			 '[2024-03-15, 2024-03-16)'::daterange, 3),
			('Meeting Room (overlapping)',
			 '[5, 8)'::int4range,
			 '[2024-03-15 10:00:00+00, 2024-03-15 12:00:00+00)'::tstzrange,
			 '[2024-03-15, 2024-03-17)'::daterange, 7),
			('Empty Range Demo',
			 'empty'::int4range,
			 'empty'::tstzrange,
			 'empty'::daterange, 1)
		ON CONFLICT DO NOTHING
	`);
	console.log('  [ok] range_booking seeded (6 rows)');

	// 9. Seed audit_log (enum, bigserial — immutable)
	await db.execute(sql`
		INSERT INTO showcase.audit_log
			(action, severity, specimen_id, actor_id, description)
		VALUES
			('create', 'info',    1,    'seed-script', 'Created specimen: Svelte Framework'),
			('create', 'info',    2,    'seed-script', 'Created specimen: PostgreSQL Database'),
			('create', 'info',    3,    'seed-script', 'Created specimen: Drizzle ORM'),
			('update', 'info',    1,    'admin',       'Updated rating from 4 to 5'),
			('update', 'info',    3,    'admin',       'Updated price from 100.00 to 150.50'),
			('delete', 'warning', NULL, 'system',      'Purged expired cache entries'),
			('login',  'info',    NULL, 'user-001',    'User logged in from 192.168.1.10'),
			('export', 'info',    NULL, 'user-001',    'Exported 42 records as CSV'),
			('restore','warning', NULL, 'admin',       'Restored soft-deleted document'),
			('update', 'error',   3,    'system',      'Failed to update: constraint violation')
		ON CONFLICT DO NOTHING
	`);
	console.log('  [ok] audit_log seeded (10 rows)');

	console.log('\nDone! Showcase schema seeded successfully.');
	console.log('Total: 7 tables, 51 rows');
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
