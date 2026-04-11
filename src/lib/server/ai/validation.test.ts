import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ChatRequestSchema, CreateConversationSchema, StreamingRequestSchema } from './validation';

describe('ChatRequestSchema', () => {
	it('accepts valid input', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
		});
		expect(result.success).toBe(true);
	});

	it('accepts optional fields', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			conversationId: '550e8400-e29b-41d4-a716-446655440000',
			useRetrieval: true,
			retrievalTiers: [1, 2],
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty messages array', () => {
		const result = v.safeParse(ChatRequestSchema, { messages: [] });
		expect(result.success).toBe(false);
	});

	it('rejects over 100 messages', () => {
		const messages = Array.from({ length: 101 }, () => ({
			role: 'user' as const,
			content: 'msg',
		}));
		const result = v.safeParse(ChatRequestSchema, { messages });
		expect(result.success).toBe(false);
	});

	it('rejects invalid conversationId (not UUID)', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			conversationId: 'not-a-uuid',
		});
		expect(result.success).toBe(false);
	});

	it('rejects content over 32k chars', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'x'.repeat(32_001) }],
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid retrievalTiers values', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			retrievalTiers: [4],
		});
		expect(result.success).toBe(false);
	});

	it('accepts valid retrievalTiers [1,2,3]', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			retrievalTiers: [1, 2, 3],
		});
		expect(result.success).toBe(true);
	});

	it('accepts valid toolScopes array', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			toolScopes: ['desk:read', 'desk:write', 'desk:create', 'desk:delete'],
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid toolScopes values', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			toolScopes: ['desk:admin'],
		});
		expect(result.success).toBe(false);
	});

	it('accepts empty toolScopes array', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			toolScopes: [],
		});
		expect(result.success).toBe(true);
	});

	it('accepts panelContext with valid entries', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
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
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			panelContext,
		});
		expect(result.success).toBe(false);
	});

	it('rejects panelContext entry content over 16000 chars', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			panelContext: [{ panelType: 'note', label: 'x', content: 'x'.repeat(16_001) }],
		});
		expect(result.success).toBe(false);
	});

	it('accepts deskLayout with valid entries', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			deskLayout: [{ panelId: 'p1', fileId: 'f1', fileType: 'spreadsheet', label: 'Budget' }],
		});
		expect(result.success).toBe(true);
	});

	it('rejects message with invalid role', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'system', content: 'Hello' }],
		});
		expect(result.success).toBe(false);
	});

	it('accepts all optional fields together', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			conversationId: '550e8400-e29b-41d4-a716-446655440000',
			useRetrieval: true,
			retrievalTiers: [1, 2],
			panelContext: [{ panelType: 'spreadsheet', label: 'Budget', content: 'A1: 100' }],
			toolScopes: ['desk:read', 'desk:write'],
			deskLayout: [{ panelId: 'p1', fileId: 'f1', fileType: 'spreadsheet', label: 'Budget' }],
		});
		expect(result.success).toBe(true);
	});
});

describe('StreamingRequestSchema', () => {
	it('accepts valid prompt', () => {
		const result = v.safeParse(StreamingRequestSchema, { prompt: 'Hello' });
		expect(result.success).toBe(true);
	});

	it('rejects empty prompt', () => {
		const result = v.safeParse(StreamingRequestSchema, { prompt: '' });
		expect(result.success).toBe(false);
	});

	it('rejects prompt over 32k chars', () => {
		const result = v.safeParse(StreamingRequestSchema, {
			prompt: 'x'.repeat(32_001),
		});
		expect(result.success).toBe(false);
	});
});

describe('CreateConversationSchema', () => {
	it('accepts empty object (title is optional)', () => {
		const result = v.safeParse(CreateConversationSchema, {});
		expect(result.success).toBe(true);
	});

	it('accepts valid title', () => {
		const result = v.safeParse(CreateConversationSchema, {
			title: 'My Chat',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty string title', () => {
		const result = v.safeParse(CreateConversationSchema, { title: '' });
		expect(result.success).toBe(false);
	});

	it('rejects title over 200 chars', () => {
		const result = v.safeParse(CreateConversationSchema, {
			title: 'x'.repeat(201),
		});
		expect(result.success).toBe(false);
	});
});

describe('PanelContextEntry extended fields', () => {
	it('accepts panelContext with status and contentLevel', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
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

	it('accepts panelContext without optional fields (backward compat)', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			panelContext: [{ panelType: 'editor', label: 'Notes', content: '# Hello' }],
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid status value', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			panelContext: [
				{ panelType: 'editor', label: 'Notes', content: 'x', status: 'unknown' },
			],
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid contentLevel value', () => {
		const result = v.safeParse(ChatRequestSchema, {
			messages: [{ role: 'user', content: 'Hello' }],
			panelContext: [
				{ panelType: 'editor', label: 'Notes', content: 'x', contentLevel: 'minimal' },
			],
		});
		expect(result.success).toBe(false);
	});
});
