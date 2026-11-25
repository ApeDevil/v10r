/**
 * What an eval's scripted follow-up presses: the Button of a surface the conversation shows,
 * found in the persisted thread, with its context resolved the way the browser resolves it —
 * every `{"@path": …}` read from the surface's data model after the script's own edits (the
 * values a user would have typed). The result is the `surfaceAction` record the chatbot
 * route admits, with a fresh event id per press.
 *
 * Alias-free and dependency-free (`scripts/ai/eval.ts` runs it under bare Bun): it reads the
 * stored parts by shape and does not re-check the policy — the server's door does that.
 */

/** A persisted row as `GET /api/ai/conversations/[id]` serves it. */
export interface StoredThreadMessage {
	id: string;
	role: string;
	content: string;
	parts?: { type: string; [key: string]: unknown }[] | null;
}

export interface SurfacePressRecord {
	action: { surfaceId: string; name: string; sourceComponentId: string; context: Record<string, unknown> };
	renderId: string;
	eventId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

interface Render {
	surfaceId: string;
	renderId: string;
	messages: Record<string, unknown>[];
}

/** Every successful `render_surface` part, in thread order. */
export function rendersOf(thread: readonly StoredThreadMessage[]): Render[] {
	const renders: Render[] = [];
	for (const message of thread) {
		for (const part of message.parts ?? []) {
			if (part.type !== 'tool-render_surface' || part.state !== 'output-available') continue;
			const output = part.output;
			if (!isRecord(output) || output.ok !== true || typeof output.surfaceId !== 'string') continue;
			if (!Array.isArray(output.messages) || typeof part.toolCallId !== 'string') continue;
			renders.push({ surfaceId: output.surfaceId, renderId: part.toolCallId, messages: output.messages });
		}
	}
	return renders;
}

const segments = (path: string) => path.split('/').filter(Boolean);

function readPath(model: Record<string, unknown>, path: string): unknown {
	let at: unknown = model;
	for (const key of segments(path)) at = isRecord(at) ? at[key] : undefined;
	return at;
}

function writePath(model: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
	const keys = segments(path);
	if (keys.length === 0) return isRecord(value) ? structuredClone(value) : {};
	let at = model;
	for (const key of keys.slice(0, -1)) {
		if (!isRecord(at[key])) at[key] = {};
		at = at[key] as Record<string, unknown>;
	}
	at[keys.at(-1) as string] = structuredClone(value);
	return model;
}

function resolve(value: unknown, model: Record<string, unknown>): unknown {
	if (Array.isArray(value)) return value.map((item) => resolve(item, model));
	if (!isRecord(value)) return value;
	if (typeof value['@path'] === 'string' && Object.keys(value).length === 1) return readPath(model, value['@path']);
	return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, resolve(inner, model)]));
}

/**
 * The press a scripted follow-up makes: on the latest render of the most recently rendered
 * surface, the Button that declares `event` (any Button when `event` is omitted), after
 * writing `values` (data-model path → value) the way a user's edits would. Null when the
 * thread shows no such Button.
 */
export function scriptedSurfacePress(
	thread: readonly StoredThreadMessage[],
	{ event, values = {} }: { event?: string; values?: Record<string, unknown> },
	eventId: string = crypto.randomUUID(),
): SurfacePressRecord | null {
	const renders = rendersOf(thread);
	const latest = renders.at(-1);
	if (!latest) return null;
	let model: Record<string, unknown> = {};
	const components = new Map<string, Record<string, unknown>>();
	for (const render of renders.filter((r) => r.surfaceId === latest.surfaceId)) {
		for (const message of render.messages) {
			if (isRecord(message.createSurface)) {
				components.clear();
				model = isRecord(message.createSurface.dataModel) ? structuredClone(message.createSurface.dataModel) : {};
			}
			const list = isRecord(message.createSurface)
				? message.createSurface.components
				: isRecord(message.updateComponents)
					? message.updateComponents.components
					: undefined;
			if (Array.isArray(list))
				for (const c of list) if (isRecord(c) && typeof c.id === 'string') components.set(c.id, c);
			if (isRecord(message.updateDataModel)) {
				const path = typeof message.updateDataModel.path === 'string' ? message.updateDataModel.path : '/';
				model = writePath(model, path, message.updateDataModel.value);
			}
			if (isRecord(message.deleteSurface)) {
				components.clear();
				model = {};
			}
		}
	}
	for (const [path, value] of Object.entries(values)) model = writePath(model, path, value);
	for (const component of components.values()) {
		if (component.component !== 'Button' || !isRecord(component.action) || !isRecord(component.action.event)) continue;
		const declared = component.action.event;
		if (typeof declared.name !== 'string' || (event !== undefined && declared.name !== event)) continue;
		const context = resolve(isRecord(declared.context) ? declared.context : {}, model);
		return {
			action: {
				surfaceId: latest.surfaceId,
				name: declared.name,
				sourceComponentId: component.id as string,
				context: isRecord(context) ? context : {},
			},
			renderId: latest.renderId,
			eventId,
		};
	}
	return null;
}

/** The stored thread as the UI messages a browser would send back as history. */
export function historyOf(thread: readonly StoredThreadMessage[]) {
	return thread.map((m) => ({
		id: m.id,
		role: m.role,
		parts: m.parts?.length ? m.parts : [{ type: 'text', text: m.content }],
	}));
}
