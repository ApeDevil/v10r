/**
 * Assistant profile — the client-safe contract of what each AI surface's assistant IS:
 * its identity, the capabilities it is composed from, and the grounding sources it draws on.
 *
 * The server composes a turn from the profile (`$lib/server/ai/profile/`); this module is
 * the vocabulary the trace (`$lib/types/turn-trace.ts`), the tool manifest
 * (`$lib/types/ai-tools.ts`) and the inspector share, and the wire shape of
 * `GET /api/ai/profiles/[surface]`. Framework-free, server-free.
 */

import type { DeskToolScope } from './ai-tools';
import type { AiSurface } from './db-enums';

/** A grounding source — one corpus or index a capability can draw on. */
export type GroundingSourceId = 'project-docs' | 'project-map' | 'catalog' | 'pattern-library' | 'desk';

/**
 * One thing an assistant can do — tools with their when-to-use guidance, an activation
 * rule, an optional grounding source, optional on-demand detail, an optional verifier.
 * `AssistantCapability` on the server is the implementation; this is its name.
 */
export type CapabilityId =
	// shared
	| 'completion'
	| 'compaction'
	// chatbot
	| 'project-map'
	| 'project-docs'
	| 'catalog'
	| 'navigation'
	| 'pattern-library'
	| 'site-awareness'
	// deskbot
	| 'desk-awareness'
	| 'desk-files'
	| 'desk-edit'
	| 'desk-create'
	| 'desk-delete'
	| 'desk-ask'
	| 'desk-plan';

/** A tool as the profile manifest projects it: the model-facing definition, verbatim. */
export interface ToolManifestEntry {
	name: string;
	description: string;
	inputSchema: unknown;
}

/** One capability of a profile, as the manifest projects it. */
export interface CapabilityManifest {
	id: CapabilityId;
	/** Desk capabilities: the consent scope that grants it and how `<permissions>` names it. */
	scope?: { id: DeskToolScope; description: string };
	/** The rule that activates it on a turn, in words. */
	when: string;
	/** Its cache-stable guidance block, when it has one. */
	guidance: string | null;
	/** The tools it mounts, with the descriptions and schemas the model receives. */
	tools: ToolManifestEntry[];
	/** The grounding sources it draws on. */
	sources: GroundingSourceId[];
}

/** What a grounding source holds for this viewer — the "available" side of a turn. */
export interface GroundingInventory {
	id: GroundingSourceId;
	documents: number;
	chunks?: number;
}

/** The profile as a signed-in user reads it — `GET /api/ai/profiles/[surface]`. */
export interface AssistantProfileManifest {
	surface: AiSurface;
	/** Hash of the identity text, every guidance block and every tool definition. */
	version: string;
	identity: { name: string; text: string };
	capabilities: CapabilityManifest[];
	grounding: GroundingInventory[];
}
