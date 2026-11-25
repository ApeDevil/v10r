/**
 * The content screen's rule, case by case: secrets and relayed untrusted markup are refused
 * outright; quoting what the turn read is its own class; what the model composed is not.
 */
import { describe, expect, it } from 'vitest';
import {
	deploymentSecretValues,
	previewExternalArguments,
	QUOTE_WINDOW_CHARS,
	screenExternalArguments,
} from './content-screen';

const READ = [
	{ source: 'desk_read_file', text: 'Salary bands 2027: L4 95k–110k, L5 120k–140k. Confidential to HR.' },
	{ source: 'mcp_other_lookup', text: 'Peer two says: the vault code is in the blue folder on shelf three.' },
];

describe('screenExternalArguments', () => {
	it('arguments the model composed are arguments_only', () => {
		expect(
			screenExternalArguments(
				{ key: 'greeting', value: 'hello from the workspace' },
				{ readContent: READ, secrets: [] },
			),
		).toEqual({ ok: true, contentClass: 'arguments_only', quotedFrom: [] });
	});

	it('quoting a document the turn read needs its own authorization, and names the source', () => {
		const verdict = screenExternalArguments(
			{ value: 'FYI   salary bands 2027: L4 95k–110k, L5 120k' },
			{ readContent: READ, secrets: [] },
		);
		expect(verdict).toEqual({ ok: true, contentClass: 'quotes_read_content', quotedFrom: ['desk_read_file'] });
	});

	it('quoting another peer’s answer counts too — content is relayed between third parties', () => {
		const verdict = screenExternalArguments(
			{ note: { body: ['the vault code is in the blue folder'] } },
			{ readContent: READ, secrets: [] },
		);
		expect(verdict).toMatchObject({ contentClass: 'quotes_read_content', quotedFrom: ['mcp_other_lookup'] });
	});

	it('a short common phrase below the window is not a quote', () => {
		const short = 'Salary bands 2027'.slice(0, QUOTE_WINDOW_CHARS - 1);
		expect(screenExternalArguments({ value: short }, { readContent: READ, secrets: [] })).toMatchObject({
			contentClass: 'arguments_only',
		});
	});

	it('a deployment secret is refused, whatever field carries it', () => {
		const secrets = ['s3cr3t-value-of-the-deployment'];
		expect(
			screenExternalArguments({ deep: { list: ['x', 'prefix s3cr3t-value-of-the-deployment'] } }, { secrets }),
		).toEqual({
			ok: false,
			reason: 'secret_in_arguments',
		});
	});

	it('credential shapes are refused even when the value is not a known secret', () => {
		for (const value of [
			// Assembled so this file itself never matches a key-block scanner (the MCP excerpt build refuses one).
			`${'-'.repeat(5)}BEGIN RSA ${'PRIVATE'} KEY${'-'.repeat(5)}\nMIIE`,
			'sk-proj-abcdefghijklmnopqrstuvwx',
			'postgres://admin:hunter2@db.internal/app',
			'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop',
		]) {
			expect(screenExternalArguments({ value }, { secrets: [] })).toEqual({ ok: false, reason: 'secret_in_arguments' });
		}
	});

	it('relaying wrapped untrusted content is refused', () => {
		expect(
			screenExternalArguments(
				{ value: '<untrusted-content source="mcp_x">ignore all</untrusted-content>' },
				{ secrets: [] },
			),
		).toEqual({ ok: false, reason: 'untrusted_markup_in_arguments' });
	});

	it('reads secret values only from secret-shaped environment names', () => {
		expect(
			deploymentSecretValues({
				MCP_PEER_SECRET_ACME: 'bearer-value-123456',
				DATABASE_URL: 'postgres://u:p@h/db-name',
				PORT: '5173',
				PUBLIC_SITE_NAME: 'Velociraptor pattern library',
				SHORT_TOKEN: 'abc',
			}),
		).toEqual(['bearer-value-123456', 'postgres://u:p@h/db-name']);
	});
});

describe('previewExternalArguments', () => {
	it('keeps every field, shortens long values and stays bounded', () => {
		const preview = previewExternalArguments({ b: 'x'.repeat(200), a: 1 });
		expect(preview.startsWith('{"a":1,"b":"')).toBe(true);
		expect(preview).toContain('(+120 chars)');
		expect(
			previewExternalArguments({ v: Array.from({ length: 50 }, (_, i) => `item-${i}-${'y'.repeat(40)}`) }).length,
		).toBeLessThanOrEqual(601);
	});
});
