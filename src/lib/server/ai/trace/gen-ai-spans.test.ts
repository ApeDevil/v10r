import { describe, expect, it } from 'vitest';
import { chatbotGrounded } from '#lib/showcases/ai/fixtures/chatbot-grounded.ts';
import { deskbotPlan } from '#lib/showcases/ai/fixtures/deskbot-plan.ts';
import { projectTurnTraceToGenAiSpans } from './gen-ai-spans';

describe('projectTurnTraceToGenAiSpans', () => {
	it('emits one invoke_agent root, one chat span per model call, one execute_tool span per execution', () => {
		const trace = chatbotGrounded.trace;
		const spans = projectTurnTraceToGenAiSpans(trace);
		expect(spans[0].operation).toBe('invoke_agent');
		expect(spans[0].parentId).toBeNull();
		expect(spans.filter((s) => s.operation === 'chat')).toHaveLength(trace.modelCalls.length);
		expect(spans.filter((s) => s.operation === 'execute_tool')).toHaveLength(trace.toolExecutions.length);
		for (const span of spans.slice(1)) expect(span.parentId).toBe('turn');
	});

	it('uses the conventions’ span names and attribute names', () => {
		const spans = projectTurnTraceToGenAiSpans(chatbotGrounded.trace);
		const chat = spans.find((s) => s.operation === 'chat');
		expect(chat?.name).toMatch(/^chat /);
		expect(chat?.attributes['gen_ai.operation.name']).toBe('chat');
		expect(chat?.attributes['gen_ai.provider.name']).toBe('gcp.gemini');
		expect(typeof chat?.attributes['gen_ai.usage.input_tokens']).toBe('number');
		const tool = spans.find((s) => s.operation === 'execute_tool');
		expect(tool?.name).toBe(`execute_tool ${tool?.attributes['gen_ai.tool.name']}`);
		expect(tool?.attributes['gen_ai.tool.call.id']).toBeTruthy();
	});

	it('sums turn usage across every provider request', () => {
		const trace = chatbotGrounded.trace;
		const [root] = projectTurnTraceToGenAiSpans(trace);
		expect(root.attributes['gen_ai.usage.input_tokens']).toBe(
			trace.modelCalls.reduce((sum, call) => sum + call.inputTokens, 0),
		);
		expect(root.attributes['gen_ai.conversation.id']).toBe(trace.conversationId);
	});

	it('never carries a body: no block text, tool input or tool output reaches a span', () => {
		for (const fixture of [chatbotGrounded, deskbotPlan]) {
			const serialized = JSON.stringify(projectTurnTraceToGenAiSpans(fixture.trace));
			for (const block of fixture.trace.blocks) {
				if (block.text && block.text.length > 40) expect(serialized).not.toContain(block.text.slice(0, 40));
			}
			for (const execution of fixture.trace.toolExecutions) {
				if (execution.output !== undefined) {
					const body = JSON.stringify(execution.output);
					if (body.length > 40) expect(serialized).not.toContain(body.slice(0, 40));
				}
			}
			expect(serialized).not.toContain('gen_ai.input.messages');
			expect(serialized).not.toContain('gen_ai.output.messages');
		}
	});

	it('keeps v10r facts in the v10r namespace and an awaiting-decision turn unset, not ok', () => {
		const spans = projectTurnTraceToGenAiSpans(deskbotPlan.trace);
		expect(spans[0].status).toBe('unset');
		expect(spans[0].attributes['v10r.proposal.id']).toBe(deskbotPlan.trace.proposalId);
		const keys = spans.flatMap((s) => Object.keys(s.attributes));
		for (const key of keys) expect(key).toMatch(/^(gen_ai|v10r|error)\./);
	});
	it('carries the cross-protocol correlation ids of an external call, and nothing it sent', () => {
		const trace = structuredClone(deskbotPlan.trace);
		const [first] = trace.toolExecutions;
		if (!first) throw new Error('fixture has no tool execution');
		first.remoteTask = {
			protocol: 'a2a',
			peerId: 'reviewer',
			operationId: 'prop-1',
			taskId: 'task-1',
			contextId: null,
		};
		const span = projectTurnTraceToGenAiSpans(trace).find((s) => s.id === `tool:${first.id}`);
		expect(span?.attributes).toMatchObject({
			'v10r.external.protocol': 'a2a',
			'v10r.external.peer': 'reviewer',
			'v10r.external.operation_id': 'prop-1',
			'v10r.a2a.task_id': 'task-1',
		});
		expect(span?.attributes).not.toHaveProperty('v10r.a2a.context_id');
	});
});
