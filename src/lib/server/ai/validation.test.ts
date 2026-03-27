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
