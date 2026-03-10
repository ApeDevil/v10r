/**
 * NETWORK REGISTRY — inet, cidr, macaddr, point types (all native in Drizzle).
 * Mutability pattern: Immutable / Append-only.
 * Once inserted, records are never updated or deleted.
 */
import { cidr, index, inet, macaddr, point, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { showcaseSchema } from './type-specimen';

export const networkRegistry = showcaseSchema.table(
	'network_registry',
	{
		id: serial('id').primaryKey(),
		deviceName: text('device_name').notNull(),

		/** inet: IP address with optional subnet mask (IPv4 or IPv6) */
		ipAddress: inet('ip_address').notNull(),

		/** cidr: network address (rejects non-zero host bits) */
		networkBlock: cidr('network_block'),

		/** macaddr: MAC (Ethernet) hardware address */
		macAddress: macaddr('mac_address'),

		/** point: geometric point (x, y) on a 2D plane */
		location: point('location', { mode: 'xy' }),

		/** Append-only: only created_at, no updated_at */
		registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		deviceIdx: index('registry_device_name_idx').on(table.deviceName),
		registeredIdx: index('registry_registered_at_idx').on(table.registeredAt),
	}),
);
