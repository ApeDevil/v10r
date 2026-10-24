<script lang="ts">
/**
 * Assistant markdown that may still be streaming.
 *
 * Every streamed delta replaces the whole text, and rendering re-parses all of it
 * (marked + sanitize-html) and swaps the subtree's innerHTML — so rendering per
 * delta costs O(n²) over an answer and lands on the main thread while the user
 * may be typing. While `streaming`, renders are coalesced to one per animation
 * frame; when the part is done the exact final text renders immediately.
 */
import { untrack } from 'svelte';
import { createAnimationFrameCoalescer } from '#lib/utils/animation-frame-coalescer.ts';
import { renderMarkdown } from '#lib/utils/markdown.ts';

interface Props {
	text: string;
	/** The text part is still receiving deltas (AI SDK `TextUIPart.state === 'streaming'`). */
	streaming?: boolean;
}

let { text, streaming = false }: Props = $props();

// Seeded with the first text so SSR and the first client render match without a frame's wait.
let renderedText = $state(untrack(() => text));
const coalescer = createAnimationFrameCoalescer<string>((value) => {
	renderedText = value;
});

$effect(() => {
	if (streaming) coalescer.push(text);
	else coalescer.flush(text);
});

$effect(() => () => coalescer.cancel());

const html = $derived(renderMarkdown(renderedText));
</script>

{@html html}
