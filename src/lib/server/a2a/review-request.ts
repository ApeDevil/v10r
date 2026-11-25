/**
 * Reading an inbound review message, fail-closed. The SDK has already validated the JSON-RPC
 * envelope and the message shape; what is left is this agent's contract:
 *
 *   - at most `A2A_SERVER_LIMITS.messageParts` parts, text parts short;
 *   - exactly one JSON data part, and it is the architecture model;
 *   - the skill comes from message metadata `skill` (absent → the full review);
 *   - the model passes `parseArchitectureModel` — strict keys, bounded sizes, no dangling refs.
 *
 * A message that breaks the contract is a refusal with reasons, never a partial review.
 */
import type { Message } from '@a2a-js/sdk';
import {
	type ArchitectureModel,
	type ModelIssue,
	parseArchitectureModel,
} from '#patterns/architecture-engineering/index.ts';
import { DEFAULT_REVIEW_SKILL, isReviewSkillId, REVIEW_SKILL_IDS, type ReviewSkillId } from './agent-card.ts';
import { A2A_SERVER_LIMITS } from './config.ts';

export type ReviewRequest =
	| { ok: true; skill: ReviewSkillId; model: ArchitectureModel }
	| { ok: false; reason: string; issues: ModelIssue[] };

/** Issues echoed back on a refusal; a hostile model can produce thousands. */
const MAX_ECHOED_ISSUES = 50;

function refuse(reason: string, issues: ModelIssue[] = []): ReviewRequest {
	return { ok: false, reason, issues: issues.slice(0, MAX_ECHOED_ISSUES) };
}

export function readReviewRequest(message: Message): ReviewRequest {
	const parts = message.parts ?? [];
	if (parts.length === 0) return refuse('the message has no parts; send the architecture model as a JSON data part');
	if (parts.length > A2A_SERVER_LIMITS.messageParts) {
		return refuse(`the message has ${parts.length} parts; at most ${A2A_SERVER_LIMITS.messageParts} are read`);
	}

	const data: unknown[] = [];
	for (const [index, part] of parts.entries()) {
		const content = part.content;
		if (content?.$case === 'data') data.push(content.value);
		else if (content?.$case === 'text') {
			if (content.value.length > A2A_SERVER_LIMITS.textPartChars) {
				return refuse(`text part ${index} exceeds ${A2A_SERVER_LIMITS.textPartChars} characters`);
			}
		} else return refuse(`part ${index} is a ${content?.$case ?? 'empty'} part; only data and text parts are read`);
	}
	if (data.length !== 1) return refuse(`expected exactly one data part (the architecture model), got ${data.length}`);

	const named = message.metadata?.skill;
	if (named !== undefined && !isReviewSkillId(named)) {
		return refuse(
			`unknown skill ${JSON.stringify(String(named)).slice(0, 80)}; this agent offers ${REVIEW_SKILL_IDS.join(', ')}`,
		);
	}
	const skill = named ?? DEFAULT_REVIEW_SKILL;

	const parsed = parseArchitectureModel(data[0]);
	if (!parsed.ok) return refuse('the data part is not a valid architecture model (format 1)', parsed.issues);
	return { ok: true, skill, model: parsed.model };
}
