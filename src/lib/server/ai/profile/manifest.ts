/**
 * Profile manifest — the client-safe projection of a profile for one viewer: the identity
 * text, every capability with its guidance and its tools as the model receives them
 * (description + JSON schema), and what each grounding source holds for this viewer.
 *
 * The "available" side of a turn, read from the profile rather than reconstructed: the
 * inspector's AVAILABLE node and the admin tool topology render from it. Signed-in only —
 * the desk inventory is the viewer's own.
 */
import { asSchema, type Tool } from 'ai';
import type { Locale } from '$lib/i18n';
import { countCorpus, countCorpusMaps } from '$lib/server/db/retrieval/queries';
import { PATTERNS } from '$lib/server/patterns';
import { PROJECT_DOCS_COLLECTION_ID, SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import { buildSearchIndex } from '$lib/server/search';
import { DESK_TOOL_SCOPES } from '$lib/types/ai-tools';
import type {
	AssistantProfileManifest,
	CapabilityManifest,
	GroundingInventory,
	GroundingSourceId,
	ToolManifestEntry,
} from '$lib/types/assistant-profile';
import { hashSystemPrompt } from '../context/history';
import { type AssistantProfile, createTurnState, identityBlock, type TurnInput } from './profile';

export interface ManifestViewer {
	userId: string;
	locale: Locale;
	authCeiling: 'admin' | 'user' | null;
}

/** A turn on which every capability is in play: tools up, every scope granted, no page. */
function everythingGranted(viewer: ManifestViewer): TurnInput {
	return {
		userId: viewer.userId,
		userMsgText: '',
		locale: viewer.locale,
		authCeiling: viewer.authCeiling,
		hasTools: true,
		toolsCooled: false,
		pageContext: null,
		scopes: [...DESK_TOOL_SCOPES],
		deskCorpus: 'ready',
	};
}

/** The tool definitions as sent: the SDK resolves the schema the same way before a provider call. */
async function toolEntries(tools: Record<string, Tool>): Promise<ToolManifestEntry[]> {
	return Promise.all(
		Object.entries(tools).map(async ([name, tool]) => ({
			name,
			description: tool.description ?? '',
			inputSchema: tool.inputSchema ? await asSchema(tool.inputSchema).jsonSchema : null,
		})),
	);
}

async function inventory(id: GroundingSourceId, viewer: ManifestViewer): Promise<GroundingInventory> {
	switch (id) {
		case 'project-docs': {
			const { documents, chunks } = await countCorpus(SYSTEM_DOCS_USER_ID, 'docs');
			return { id, documents, chunks };
		}
		case 'project-map':
			return { id, documents: await countCorpusMaps([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID) };
		case 'catalog':
			return { id, documents: buildSearchIndex(viewer.locale).length };
		case 'pattern-library':
			return { id, documents: PATTERNS.length };
		case 'desk': {
			const { documents, chunks } = await countCorpus(viewer.userId, 'desk');
			return { id, documents, chunks };
		}
	}
}

/**
 * The profile's declarative half — identity and capabilities with their tools as the model
 * receives them. No corpus read: what the admin tool topology and the version hash need.
 */
export async function profileCapabilities(
	profile: AssistantProfile,
	viewer: ManifestViewer,
): Promise<Pick<AssistantProfileManifest, 'surface' | 'version' | 'identity' | 'capabilities'>> {
	const turn = everythingGranted(viewer);
	const state = createTurnState();
	const capabilities: CapabilityManifest[] = [];
	for (const capability of profile.capabilities) {
		const tools = capability.tools ? await toolEntries(capability.tools(turn, state) as Record<string, Tool>) : [];
		capabilities.push({
			id: capability.id,
			...(capability.scope ? { scope: capability.scope } : {}),
			when: capability.when,
			guidance: capability.guidance ?? null,
			tools,
			sources: capability.sources ?? [],
		});
	}
	const identity = { name: profile.identity.name, text: identityBlock(profile.identity) };
	const version = hashSystemPrompt(
		[
			identity.text,
			...capabilities.map((c) => c.guidance ?? ''),
			JSON.stringify(capabilities.flatMap((c) => c.tools.map((t) => [t.name, t.description, t.inputSchema]))),
		].join('\n\n'),
	);
	return { surface: profile.surface, version, identity, capabilities };
}

export async function profileManifest(
	profile: AssistantProfile,
	viewer: ManifestViewer,
): Promise<AssistantProfileManifest> {
	const declared = await profileCapabilities(profile, viewer);
	const sources = new Set<GroundingSourceId>(declared.capabilities.flatMap((c) => c.sources));
	return { ...declared, grounding: await Promise.all([...sources].map((id) => inventory(id, viewer))) };
}
