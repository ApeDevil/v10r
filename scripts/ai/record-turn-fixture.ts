#!/usr/bin/env bun
/**
 * Export ONE real turn as a showcase fixture (`fixtures/chatbot-grounded.ts` for the chatbot;
 * `fixtures/deskbot-plan.ts` / `deskbot-sentinel.ts` for the deskbot, chosen with `--out`).
 *
 * The turn inspector on `/showcases/ai/<surface>` opens a persisted `TurnTrace`; signed-out
 * visitors see the committed fixtures. This script reads a turn the SAME way the page does —
 * the owner-guarded routes, nothing else — scrubs every id with the page's own `scrubTurn`
 * and writes the module. No second run, no re-composition: the fixture is the recorded
 * account of a turn that happened.
 *
 *   podman exec v10r bun run ai:record-turn -- --cookie 'better-auth.session_token=…'
 *       [--surface chatbot|deskbot] [--conversation <id>] [--message <id>]
 *       [--base http://localhost:5173] [--out <path>]
 *   podman exec v10r bun run ai:record-turn -- --from <dir> [--surface deskbot] [--out <path>]
 *
 * Two doors to the same four responses. `--cookie` is your signed-in session; the routes
 * answer 401 without it. `--from` reads the responses saved from a signed-in browser
 * instead (the cookie is httpOnly, so the page's own fetches are the door that needs no
 * secret copied): `conversations.json`, `thread.json`, `trace.json`, `profile.json`, each
 * the route's envelope as sent. Without `--conversation`/`--message` the newest recorded
 * turn of the surface in your newest conversation of that surface is taken. Review the
 * diff before committing: the turn's question, answer, prompt blocks, desk context and
 * grounding bodies become public page content.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { type InspectedTurn, scrubTurn, type ThreadMessage, turnOptions } from '../../src/lib/showcases/ai/inspector';
import type { AssistantProfileManifest } from '../../src/lib/types/assistant-profile';
import type { AiSurface } from '../../src/lib/types/db-enums';
import type { TurnSummary, TurnTrace } from '../../src/lib/types/turn-trace';

const DEFAULT_OUT: Record<AiSurface, string> = {
	chatbot: 'src/lib/showcases/ai/fixtures/chatbot-grounded.ts',
	deskbot: 'src/lib/showcases/ai/fixtures/deskbot-plan.ts',
};

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? undefined : process.argv[i + 1];
}

const from = arg('from');
const cookie = arg('cookie') ?? process.env.V10R_COOKIE;
if (!from && !cookie) {
	console.error(
		'Missing --cookie (or V10R_COOKIE): the signed-in session cookie, e.g. better-auth.session_token=… — or --from <dir> of saved responses.',
	);
	process.exit(1);
}
const surfaceArg = arg('surface') ?? 'chatbot';
if (surfaceArg !== 'chatbot' && surfaceArg !== 'deskbot') {
	console.error(`Unknown --surface ${surfaceArg}: chatbot or deskbot.`);
	process.exit(1);
}
const surface: AiSurface = surfaceArg;
const base = (arg('base') ?? 'http://localhost:5173').replace(/\/$/, '');
const out = arg('out') ?? DEFAULT_OUT[surface];
/** The module's export name follows the file: `deskbot-plan.ts` → `deskbotPlan`. */
const exportName = basename(out, '.ts').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Which saved response answers a route when reading `--from` a directory. */
const SAVED_RESPONSE: [RegExp, string][] = [
	[/^\/api\/ai\/conversations\?/, 'conversations.json'],
	[/^\/api\/ai\/conversations\/[^/?]+$/, 'thread.json'],
	[/^\/api\/ai\/conversations\/[^/]+\/turns\//, 'trace.json'],
	[/^\/api\/ai\/profiles\//, 'profile.json'],
];

async function get<T>(path: string): Promise<T> {
	if (from) {
		const file = SAVED_RESPONSE.find(([route]) => route.test(path))?.[1];
		if (!file) throw new Error(`No saved response maps to ${path}`);
		return (JSON.parse(readFileSync(join(from, file), 'utf8')) as { data: T }).data;
	}
	const res = await fetch(`${base}${path}`, {
		headers: { cookie: cookie as string, 'X-Requested-With': 'sveltekit', accept: 'application/json' },
	});
	if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text().catch(() => '')}`);
	const envelope = (await res.json()) as { data: T };
	return envelope.data;
}

const conversationId =
	arg('conversation') ??
	(await get<{ items: { id: string; surface: AiSurface | null }[] }>('/api/ai/conversations?pageSize=25')).items.find(
		(c) => c.surface === surface || c.surface === null,
	)?.id;
if (!conversationId) {
	console.error(`No ${surface} conversation found — run a ${surface} turn first.`);
	process.exit(1);
}

const thread = await get<{ messages: ThreadMessage[]; turns: TurnSummary[] }>(
	`/api/ai/conversations/${conversationId}`,
);
const surfaceTurns = thread.turns.filter((t) => t.surface === surface);
const messageId = arg('message') ?? surfaceTurns[surfaceTurns.length - 1]?.messageId;
if (!messageId) {
	console.error(`Conversation ${conversationId} has no recorded ${surface} turn.`);
	process.exit(1);
}

const [trace, profile] = await Promise.all([
	get<TurnTrace>(`/api/ai/conversations/${conversationId}/turns/${messageId}`),
	get<AssistantProfileManifest>(`/api/ai/profiles/${surface}`),
]);
const question = turnOptions(thread.messages, thread.turns).find((t) => t.messageId === messageId)?.question ?? '';
const answer = thread.messages.find((m) => m.id === messageId)?.content ?? '';

const turn: InspectedTurn = scrubTurn({
	provenance: { kind: 'recorded', recordedAt: trace.createdAt.slice(0, 10) },
	question,
	answer,
	trace,
	profile,
});

const header = `/**
 * A turn the ${surface} page opens signed-out — a RECORDED real dev turn in the persisted
 * shape (\`InspectedTurn\`: a \`TurnTrace\` plus the words around it and the profile it ran on).
 *
 * Exported by \`scripts/ai/record-turn-fixture.ts\` on ${turn.provenance.recordedAt} from the
 * owner-guarded routes, ids scrubbed by \`scrubTurn\`, nothing else changed. Re-run the script
 * to refresh it; never hand-edit. Ids are \`demo_\` by construction (the leak gate forbids real ones).
 */

import type { InspectedTurn } from '../inspector';

export const ${exportName}: InspectedTurn = `;

writeFileSync(out, `${header}${JSON.stringify(turn, null, '\t')};\n`);
console.log(
	`[ai:record-turn] wrote ${out} (${exportName}) — ${trace.blocks.length} blocks, ${trace.modelCalls.length} model calls, ` +
		`${trace.toolExecutions.length} tool executions, ${trace.citations.length} citations` +
		`${trace.proposal ? `, proposal ${trace.proposal.status}` : ''}. ` +
		`Run \`bunx biome check --write ${out}\` and review the diff before committing.`,
);
