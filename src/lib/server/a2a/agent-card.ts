/**
 * The Agent Card for v10r's architecture review agent — what `/.well-known/agent-card.json`
 * serves and what the JSON-RPC handler validates `A2A-Version` against.
 *
 * The agent wraps the deterministic Architecture Engineering checks (no model, no keys): a
 * caller sends an architecture model as a data part and gets findings back as an artifact. The
 * card is public and unauthenticated on purpose — the checks read only the model they are sent.
 *
 * "Skill" here is the A2A protocol's word for one Agent Card entry, distinct from an assistant
 * `capability` (`docs/naming.md`).
 */
import type { AgentCard, AgentSkill } from '@a2a-js/sdk';
import { A2A_ENDPOINT_PATH, A2A_PROTOCOL_VERSION, ARCHITECTURE_REVIEW_AGENT_VERSION } from './config.ts';

export const REVIEW_SKILL_IDS = ['architecture-security-review', 'architecture-review'] as const;
export type ReviewSkillId = (typeof REVIEW_SKILL_IDS)[number];

/** Used when a message names no skill: the full review is the superset. */
export const DEFAULT_REVIEW_SKILL: ReviewSkillId = 'architecture-review';

const JSON_MODE = 'application/json';
const TEXT_MODE = 'text/plain';

const SKILLS: Record<ReviewSkillId, Omit<AgentSkill, 'id' | 'securityRequirements'>> = {
	'architecture-security-review': {
		name: 'Architecture security review',
		description:
			'Runs the Architecture Engineering security checks over an architecture model (format 1): secrets on client nodes, unauthenticated or unstated trust-boundary crossings, direct client data access. Send the model as a JSON data part; set message metadata `skill` to this id. Returns the findings as a JSON data part plus a text summary.',
		tags: ['architecture', 'security', 'deterministic'],
		examples: ['{"skill":"architecture-security-review"} + an ArchitectureModel JSON data part'],
		inputModes: [JSON_MODE],
		outputModes: [JSON_MODE, TEXT_MODE],
	},
	'architecture-review': {
		name: 'Architecture review',
		description:
			'Runs every Architecture Engineering check (security, runtime, communication, data, structure) over an architecture model (format 1). Same input and output as architecture-security-review; this is the default when no skill is named.',
		tags: ['architecture', 'review', 'deterministic'],
		examples: ['An ArchitectureModel JSON data part'],
		inputModes: [JSON_MODE],
		outputModes: [JSON_MODE, TEXT_MODE],
	},
};

export function isReviewSkillId(value: unknown): value is ReviewSkillId {
	return typeof value === 'string' && (REVIEW_SKILL_IDS as readonly string[]).includes(value);
}

/**
 * Build the card for the deployment at `origin` (`https://v10r.example`, no path). The
 * interface URL is absolute because a card is read by a client that may not know where it came
 * from; the origin is the request's, so previews and local runs advertise themselves.
 */
export function buildArchitectureReviewCard(origin: string): AgentCard {
	return {
		name: 'v10r architecture review agent',
		description:
			'Deterministic architecture review of a v10r Architecture Studio model. No language model is involved: the same model always yields the same findings. Tasks complete within the request; none is retained afterwards.',
		version: ARCHITECTURE_REVIEW_AGENT_VERSION,
		provider: { organization: 'Velociraptor (v10r)', url: origin },
		documentationUrl: `${origin}/studio/architecture`,
		supportedInterfaces: [
			{
				url: `${origin}${A2A_ENDPOINT_PATH}`,
				protocolBinding: 'JSONRPC',
				protocolVersion: A2A_PROTOCOL_VERSION,
				tenant: '',
			},
		],
		// Streaming is real (SendStreamingMessage answers SSE). Push notifications and the
		// extended card are not offered: no task outlives its request, and nothing is gated.
		capabilities: { streaming: true, pushNotifications: false, extendedAgentCard: false, extensions: [] },
		securitySchemes: {},
		securityRequirements: [],
		defaultInputModes: [JSON_MODE],
		defaultOutputModes: [JSON_MODE, TEXT_MODE],
		skills: REVIEW_SKILL_IDS.map((id) => ({ id, ...SKILLS[id], securityRequirements: [] })),
		signatures: [],
	};
}
