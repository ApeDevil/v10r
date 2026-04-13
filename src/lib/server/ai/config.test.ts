import { describe, expect, it } from 'vitest';
import { buildPermissionsBlock, COMPLETION_BLOCK, PLANNING_BLOCK } from './config';

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

describe('COMPLETION_BLOCK', () => {
	it('wraps in <completion> tags', () => {
		expect(COMPLETION_BLOCK).toMatch(/^<completion>\n/);
		expect(COMPLETION_BLOCK).toMatch(/\n<\/completion>$/);
	});

	it('tells the model it may stop when request is satisfied', () => {
		expect(COMPLETION_BLOCK).toMatch(/may stop calling tools/i);
	});

	it('instructs continuation through approved plans', () => {
		expect(COMPLETION_BLOCK).toMatch(/approved plan/i);
	});
});

describe('PLANNING_BLOCK', () => {
	it('wraps in <planning> tags', () => {
		expect(PLANNING_BLOCK).toMatch(/^<planning>\n/);
		expect(PLANNING_BLOCK).toMatch(/\n<\/planning>$/);
	});

	it('references the desk_propose_plan tool', () => {
		expect(PLANNING_BLOCK).toContain('desk_propose_plan');
	});

	it('excludes single-tool reads from the planning requirement', () => {
		expect(PLANNING_BLOCK).toMatch(/Do NOT/i);
		expect(PLANNING_BLOCK).toContain('desk_list_files');
		expect(PLANNING_BLOCK).toContain('desk_read_file');
	});

	it('prevents re-planning after plan approval', () => {
		expect(PLANNING_BLOCK).toMatch(/already approved/i);
	});
});
