<script lang="ts">
import { type FitViewOptions, useNodesInitialized, useSvelteFlow } from '@xyflow/svelte';

// Refit the viewport whenever `fitKey` changes — a structural change the caller names (a
// pane opening beside the canvas, the reader asking for it). Lives inside <SvelteFlow>, where
// the flow's own hook is reachable; waits for the nodes to be measured (a fit over unmeasured
// nodes is a no-op), then a frame later, so explicit node sizes have been applied.
let { fitKey, options }: { fitKey: unknown; options?: FitViewOptions } = $props();

const flow = useSvelteFlow();
const initialized = useNodesInitialized();

$effect(() => {
	void fitKey;
	if (!initialized.current) return;
	const frame = requestAnimationFrame(() => void flow.fitView(options));
	return () => cancelAnimationFrame(frame);
});
</script>
