import { describe, expect, it } from 'vitest';
import { buildCapabilitiesBlock, buildPermissionsBlock, PANEL_CAPABILITIES } from './config';

describe('buildPermissionsBlock', () => {
	it('marks all scopes as enabled when all provided', () => {
		const result = buildPermissionsBlock(['desk:read', 'desk:write', 'desk:create', 'desk:delete']);
		expect(result).toContain('[enabled]');
		expect(result).not.toContain('[disabled]');
	});

	it('marks all scopes as disabled when none provided', () => {
		const result = buildPermissionsBlock([]);
		expect(result).not.toContain('[enabled]');
		expect(result).toContain('[disabled]');
	});

	it('marks only provided scopes as enabled', () => {
		const result = buildPermissionsBlock(['desk:read', 'desk:write']);
		const lines = result.split('\n');
		const readLine = lines.find((l) => l.includes('read:'));
		const writeLine = lines.find((l) => l.includes('write:'));
		const createLine = lines.find((l) => l.includes('create:'));
		const deleteLine = lines.find((l) => l.includes('delete:'));

		expect(readLine).toContain('[enabled]');
		expect(writeLine).toContain('[enabled]');
		expect(createLine).toContain('[disabled]');
		expect(deleteLine).toContain('[disabled]');
	});

	it('wraps in <permissions> tags', () => {
		const result = buildPermissionsBlock(['desk:read']);
		expect(result).toMatch(/^<permissions>\n/);
		expect(result).toMatch(/\n<\/permissions>$/);
	});

	it('always lists all 4 scopes', () => {
		const result = buildPermissionsBlock([]);
		expect(result).toContain('read:');
		expect(result).toContain('write:');
		expect(result).toContain('create:');
		expect(result).toContain('delete:');
	});

	it('write scope description includes markdown', () => {
		const result = buildPermissionsBlock(['desk:write']);
		expect(result).toContain('markdown');
	});
});

describe('buildCapabilitiesBlock', () => {
	it('wraps in <available-panels> tags', () => {
		const result = buildCapabilitiesBlock();
		expect(result).toMatch(/^<available-panels>\n/);
		expect(result).toMatch(/\n<\/available-panels>$/);
	});

	it('lists all panel types from PANEL_CAPABILITIES', () => {
		const result = buildCapabilitiesBlock();
		for (const type of Object.keys(PANEL_CAPABILITIES)) {
			expect(result).toContain(type);
		}
	});

	it('includes tool names for panels that have them', () => {
		const result = buildCapabilitiesBlock();
		expect(result).toContain('desk_read_file');
		expect(result).toContain('desk_update_cells');
		expect(result).toContain('desk_update_markdown');
	});

	it('does not include tools for read-only panels', () => {
		const result = buildCapabilitiesBlock();
		// preview line should not have [tools: ...] since it has empty tools array
		const lines = result.split('\n');
		const previewLine = lines.find((l) => l.includes('preview:'));
		expect(previewLine).not.toContain('[tools:');
	});
});
