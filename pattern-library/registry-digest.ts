/**
 * The registry's content identity: a SHA-256 over its canonical JSON serialization, cut to 16 hex
 * characters. Two registries with the same digest hold the same knowledge, whatever their file
 * formatting; any change to a record, relationship or vocabulary entry changes it. Benchmarks,
 * tool responses and derived surfaces carry it instead of a hand-bumped version string, so a
 * result can always say exactly which registry it was measured on.
 *
 * Server-side only (`node:crypto`, available under Bun and Node alike); never import it from code
 * that ships to the browser.
 */
import { createHash } from 'node:crypto';
import type { Registry } from './schema.ts';

export function registryDigest(registry: Registry): string {
	return createHash('sha256').update(JSON.stringify(registry)).digest('hex').slice(0, 16);
}
