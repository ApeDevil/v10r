/** The profiles, by surface — the orchestrator's one door to what each assistant is. */
import type { AiSurface } from '$lib/types/db-enums';
import { CHATBOT_PROFILE } from './chatbot';
import { DESKBOT_PROFILE } from './deskbot';
import type { AssistantProfile } from './profile';

export const PROFILES: Record<AiSurface, AssistantProfile> = {
	chatbot: CHATBOT_PROFILE,
	deskbot: DESKBOT_PROFILE,
};

export type {
	AssistantCapability,
	AssistantIdentity,
	AssistantProfile,
	SurfacedCatalogRow,
	TurnComposition,
	TurnInput,
	TurnState,
} from './profile';
export { composeTurn, identityBlock } from './profile';
