/**
 * llmwiki compile pipeline — raw chunks → wiki pages.
 *
 * Status: scaffold. Read-path + tools ship first; compile unblocks real data
 * once page-kind prompts, model routing, and cite-back hashing land.
 *
 * Planned entry point:
 *   compilePage(sourceChunks: RawChunk[], kind: LlmwikiPageKind): Promise<LlmwikiPage>
 */

export const COMPILE_SCAFFOLD = true as const;
