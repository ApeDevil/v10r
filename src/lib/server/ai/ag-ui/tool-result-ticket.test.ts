import { describe, expect, it } from 'vitest';
import { AG_UI_RESULT_TICKET_TTL_MS, checkToolResultTicket, issueToolResultTicket } from './tool-result-ticket';

const facts = {
	userId: 'user-1',
	toolCallId: 'call-1',
	toolName: 'desk_list_files',
	args: '',
	content: '[withheld by the export policy]',
};

describe('tool result tickets', () => {
	it('verifies exactly the facts it was issued for', () => {
		const ticket = issueToolResultTicket(facts);
		expect(checkToolResultTicket(ticket, facts)).toBe('valid');
		for (const changed of [
			{ userId: 'user-2' },
			{ toolCallId: 'call-2' },
			{ toolName: 'desk_delete_file' },
			{ args: '{"file_id":"fil_x"}' },
			{ content: '{"items":[]}' },
		]) {
			expect(checkToolResultTicket(ticket, { ...facts, ...changed }), JSON.stringify(changed)).toBe('invalid');
		}
	});

	it('refuses an invented id and calls an old ticket expired, not forged', () => {
		expect(checkToolResultTicket('call-1:result', facts)).toBe('invalid');
		const now = Date.now();
		const ticket = issueToolResultTicket(facts, now);
		expect(checkToolResultTicket(ticket, facts, now + AG_UI_RESULT_TICKET_TTL_MS + 1)).toBe('expired');
	});
});
