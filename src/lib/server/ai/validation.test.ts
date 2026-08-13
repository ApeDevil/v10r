import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
	ChatbotRequestSchema,
	ContextProbeRequestSchema,
	CreateConversationSchema,
	DeskRequestSchema,
} from './validation';

const HELLO = [{ role: 'user' as const, content: 'Hello' }];

describe('ChatbotRequestSchema (read-only grounded surface)', () => {
	it('accepts valid input', () => {
		const result = v.safeParse(ChatbotRequestSchema, { messages: HELLO });
		expect(result.success).toBe(true);
	});

	it('accepts optional envelope fields', () => {
		const result = v.safeParse(ChatbotRequestSchema, {
			messages: HELLO,
			conversationId: '550e8400-e29b-41d4-a716-446655440000',
			providerId: 'groq',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty messages array', () => {
		expect(v.safeParse(ChatbotRequestSchema, { messages: [] }).success).toBe(false);
	});

	it('rejects over 100 messages', () => {
		const messages = Array.from({ length: 101 }, () => ({ role: 'user' as const, content: 'msg' }));
		expect(v.safeParse(ChatbotRequestSchema, { messages }).success).toBe(false);
	});

	it('rejects invalid conversationId (not UUID)', () => {
		const result = v.safeParse(ChatbotRequestSchema, { messages: HELLO, conversationId: 'not-a-uuid' });
		expect(result.success).toBe(false);
	});

	it('rejects content over 32k chars', () => {
		const result = v.safeParse(ChatbotRequestSchema, { messages: [{ role: 'user', content: 'x'.repeat(32_001) }] });
		expect(result.success).toBe(false);
	});

	it('rejects message with invalid role', () => {
		expect(v.safeParse(ChatbotRequestSchema, { messages: [{ role: 'system', content: 'Hello' }] }).success).toBe(false);
	});

	it('accepts a well-formed pageRouteId (site-awareness)', () => {
		const result = v.safeParse(ChatbotRequestSchema, {
			messages: HELLO,
			pageRouteId: '/[[locale=locale]]/(public)/showcases/forms',
		});
		expect(result.success).toBe(true);
	});

	it('rejects a pageRouteId with breakout chars', () => {
		const result = v.safeParse(ChatbotRequestSchema, { messages: HELLO, pageRouteId: '/foo?x=<script>' });
		expect(result.success).toBe(false);
	});

	// Surface isolation: the read-only surface must never carry desk-mutation fields into the
	// orchestrator. `v.object` drops unknown keys, so a stray desk field parses but is stripped.
	it('strips desk-mutation fields from the parsed output', () => {
		const result = v.safeParse(ChatbotRequestSchema, {
			messages: HELLO,
			toolScopes: ['desk:read'],
			panelContext: [{ panelType: 'spreadsheet', label: 'Budget', content: 'A1: 100' }],
			deskLayout: [{ panelId: 'p1', label: 'Budget' }],
			activeWorkspace: { id: 'w1', name: 'Home' },
			resumeFromProposalId: 'prop_1',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect('toolScopes' in result.output).toBe(false);
			expect('panelContext' in result.output).toBe(false);
			expect('deskLayout' in result.output).toBe(false);
			expect('activeWorkspace' in result.output).toBe(false);
			expect('resumeFromProposalId' in result.output).toBe(false);
		}
	});
});

describe('DeskRequestSchema (mutating operator surface)', () => {
	it('accepts valid toolScopes array', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			toolScopes: ['desk:read', 'desk:write', 'desk:create', 'desk:delete'],
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid toolScopes values', () => {
		expect(v.safeParse(DeskRequestSchema, { messages: HELLO, toolScopes: ['desk:admin'] }).success).toBe(false);
	});

	it('accepts empty toolScopes array', () => {
		expect(v.safeParse(DeskRequestSchema, { messages: HELLO, toolScopes: [] }).success).toBe(true);
	});

	it('accepts panelContext with valid entries', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			panelContext: [{ panelType: 'spreadsheet', label: 'Budget', content: 'A1: 100' }],
		});
		expect(result.success).toBe(true);
	});

	it('rejects panelContext over 5 entries', () => {
		const panelContext = Array.from({ length: 6 }, (_, i) => ({
			panelType: 'note',
			label: `Panel ${i}`,
			content: 'data',
		}));
		expect(v.safeParse(DeskRequestSchema, { messages: HELLO, panelContext }).success).toBe(false);
	});

	it('rejects panelContext entry content over 16000 chars', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			panelContext: [{ panelType: 'note', label: 'x', content: 'x'.repeat(16_001) }],
		});
		expect(result.success).toBe(false);
	});

	it('accepts deskLayout with valid entries', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			deskLayout: [{ panelId: 'p1', fileId: 'f1', fileType: 'spreadsheet', label: 'Budget' }],
		});
		expect(result.success).toBe(true);
	});

	it('accepts activeWorkspace + resumeFromProposalId', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			activeWorkspace: { id: 'w1', name: 'Home' },
			resumeFromProposalId: '550e8400-e29b-41d4-a716-446655440000',
		});
		expect(result.success).toBe(true);
	});

	it('accepts all desk fields together', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			conversationId: '550e8400-e29b-41d4-a716-446655440000',
			panelContext: [{ panelType: 'spreadsheet', label: 'Budget', content: 'A1: 100' }],
			toolScopes: ['desk:read', 'desk:write'],
			deskLayout: [{ panelId: 'p1', fileId: 'f1', fileType: 'spreadsheet', label: 'Budget' }],
		});
		expect(result.success).toBe(true);
	});

	it('rejects message with invalid role (shared base)', () => {
		expect(v.safeParse(DeskRequestSchema, { messages: [{ role: 'system', content: 'Hi' }] }).success).toBe(false);
	});
});

describe('PanelContextEntry extended fields (deskbot)', () => {
	it('accepts panelContext with status and contentLevel', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			panelContext: [
				{
					panelType: 'spreadsheet',
					label: 'Budget',
					content: 'A1: 100',
					status: 'focused',
					contentLevel: 'full',
					tokenEstimate: 2,
				},
			],
		});
		expect(result.success).toBe(true);
	});

	it('accepts panelContext without optional fields', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			panelContext: [{ panelType: 'editor', label: 'Notes', content: '# Hello' }],
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid status value', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			panelContext: [{ panelType: 'editor', label: 'Notes', content: 'x', status: 'unknown' }],
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid contentLevel value', () => {
		const result = v.safeParse(DeskRequestSchema, {
			messages: HELLO,
			panelContext: [{ panelType: 'editor', label: 'Notes', content: 'x', contentLevel: 'minimal' }],
		});
		expect(result.success).toBe(false);
	});
});

describe('CreateConversationSchema', () => {
	it('accepts empty object (title is optional)', () => {
		expect(v.safeParse(CreateConversationSchema, {}).success).toBe(true);
	});

	it('accepts valid title', () => {
		expect(v.safeParse(CreateConversationSchema, { title: 'My Chat' }).success).toBe(true);
	});

	it('rejects empty string title', () => {
		expect(v.safeParse(CreateConversationSchema, { title: '' }).success).toBe(false);
	});

	it('rejects title over 200 chars', () => {
		expect(v.safeParse(CreateConversationSchema, { title: 'x'.repeat(201) }).success).toBe(false);
	});
});

describe('ContextProbeRequestSchema (showcase context x-ray)', () => {
	it('accepts a chatbot probe with pageRouteId', () => {
		const result = v.safeParse(ContextProbeRequestSchema, {
			surface: 'chatbot',
			query: 'How does the guard chain work?',
			pageRouteId: '/[[locale=locale]]/(public)/showcases/ai/chatbot',
		});
		expect(result.success).toBe(true);
	});

	it('accepts a deskbot probe with toolScopes', () => {
		const result = v.safeParse(ContextProbeRequestSchema, {
			surface: 'deskbot',
			query: 'Delete all completed rows from every sheet',
			toolScopes: ['desk:read', 'desk:delete'],
		});
		expect(result.success).toBe(true);
	});

	it('rejects an unknown surface', () => {
		expect(v.safeParse(ContextProbeRequestSchema, { surface: 'rag-demo', query: 'x' }).success).toBe(false);
	});

	it('rejects an empty query', () => {
		expect(v.safeParse(ContextProbeRequestSchema, { surface: 'chatbot', query: '' }).success).toBe(false);
	});

	it('rejects a query over 2000 chars', () => {
		expect(v.safeParse(ContextProbeRequestSchema, { surface: 'chatbot', query: 'x'.repeat(2001) }).success).toBe(false);
	});

	it('rejects a pageRouteId with breakout chars', () => {
		expect(
			v.safeParse(ContextProbeRequestSchema, { surface: 'chatbot', query: 'hi there', pageRouteId: '/a"b' }).success,
		).toBe(false);
	});

	it('rejects invalid toolScopes values', () => {
		expect(
			v.safeParse(ContextProbeRequestSchema, { surface: 'deskbot', query: 'hi there', toolScopes: ['desk:root'] })
				.success,
		).toBe(false);
	});
});
