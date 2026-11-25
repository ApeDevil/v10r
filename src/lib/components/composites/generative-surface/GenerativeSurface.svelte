<script lang="ts">
/**
 * GenerativeSurface — renders one A2UI v1.0 surface with v10r components.
 *
 * This is the heavy renderer (it pulls `@a2ui/web_core`, ~70 KB gzip). Pages and the chat
 * client use `LazyGenerativeSurface`, which loads it only when a surface is actually shown.
 *
 * `messages` is either an append-only batch list (a later, longer array applies only the new
 * tail — that is how a follow-up batch reaches an already rendered surface) or an async
 * stream of messages/batches. To show a different surface, re-key the component. Every batch passes the surface policy first; a refused batch
 * leaves the surface as it was and shows a notice.
 */
import { onDestroy, untrack } from 'svelte';
import type { GenerativeSurfaceAction, GenerativeSurfaceRefusal } from '#lib/generative-ui/index.ts';
import { cn } from '#lib/utils/cn.ts';
import GenerativeSurfaceNode from './GenerativeSurfaceNode.svelte';
import { DEFAULT_GENERATIVE_SURFACE_LABELS, type GenerativeSurfaceLabels } from './labels.ts';
import { createGenerativeSurfaceSession, type GenerativeSurfaceInput } from './surface-session.svelte.ts';

interface Props {
	messages: GenerativeSurfaceInput;
	/** A Button was pressed. The event is data for the assistant — it never authorizes a write. */
	onaction?: (action: GenerativeSurfaceAction) => void;
	onrefusal?: (refusals: readonly GenerativeSurfaceRefusal[]) => void;
	labels?: Partial<GenerativeSurfaceLabels>;
	class?: string;
}

let { messages, onaction, onrefusal, labels: labelOverrides, class: className }: Props = $props();

const labels = $derived({ ...DEFAULT_GENERATIVE_SURFACE_LABELS, ...labelOverrides });

const session = createGenerativeSurfaceSession({
	onaction: (action) => onaction?.(action),
	onrefusal: (refusals) => onrefusal?.(refusals),
});

let applied = 0;
let source: GenerativeSurfaceInput | undefined;

function isStream(input: GenerativeSurfaceInput): input is AsyncIterable<unknown> {
	return !Array.isArray(input) && typeof (input as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function';
}

/** Apply what `messages` holds that has not been applied yet. */
function sync(input: GenerativeSurfaceInput): AbortController | undefined {
	if (isStream(input)) {
		if (input === source) return undefined;
		source = input;
		const controller = new AbortController();
		void session.consume(input, controller.signal);
		return controller;
	}
	const list = input as readonly unknown[];
	// A batch of messages is applied as one, so the policy sees the whole batch at once.
	if (list.length > applied) session.apply(list.slice(applied));
	applied = list.length;
	return undefined;
}

// A batch list applies synchronously, so server rendering shows the initial surface (effects
// do not run there). A stream starts in the effect, which owns its cancellation.
untrack(() => {
	if (!isStream(messages)) sync(messages);
});

$effect(() => {
	const controller = sync(messages);
	return () => controller?.abort();
});

onDestroy(() => session.dispose());

const status = $derived(
	session.refusals.length > 0
		? labels.refused
		: session.batches === 0
			? ''
			: session.batches === 1
				? labels.shown
				: labels.updated,
);
</script>

<section
	class={cn('generative-surface flex flex-col gap-3', className)}
	aria-label={labels.region}
	aria-busy={session.streaming}
	data-surface-id={session.surfaceId}
>
	{#if session.root}
		<GenerativeSurfaceNode node={session.root} {labels} />
	{/if}
	{#if session.refusals.length > 0}
		<p class="text-fluid-sm text-error" data-generative-refused>{labels.refused}</p>
	{/if}
	<p class="sr-only" aria-live="polite" aria-atomic="true">{status}</p>
</section>
