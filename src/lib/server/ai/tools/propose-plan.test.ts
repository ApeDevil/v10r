/**
 * Guards the plan-replay arg contract at the schema layer: each proposed step
 * MUST carry an `args` object. Without it the model never supplies the file ids
 * the approve-route replay needs, and approved plans persist with empty args —
 * the exact gap that left destructive plans un-executable (and silently re-run
 * by the resume turn instead).
 */
import { describe, expect, it } from 'vitest';
import { createProposePlanTool } from './propose-plan';

describe('desk_propose_plan input schema', () => {
	it('requires per-step args so approved plans carry execution arguments', () => {
		const tool = createProposePlanTool().desk_propose_plan;
		// AI SDK wraps the raw JSON Schema under `.jsonSchema`; fall back to the
		// object itself if a future version exposes it directly.
		const raw =
			(tool.inputSchema as { jsonSchema?: Record<string, unknown> }).jsonSchema ??
			(tool.inputSchema as Record<string, unknown>);
		const stepItem = (
			raw as { properties: { steps: { items: { properties: Record<string, unknown>; required: string[] } } } }
		).properties.steps.items;
		expect(stepItem.properties).toHaveProperty('args');
		expect(stepItem.required).toContain('args');
	});
});
