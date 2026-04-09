<script lang="ts">
/**
 * Top progress bar during page transitions.
 * Uses SvelteKit's navigating state.
 */

import { navigating } from '$app/state';

let progress = $state(0);
let visible = $state(false);

// Animate progress when navigating
$effect(() => {
	if (navigating) {
		visible = true;
		progress = 0;

		// Quickly progress to 90%
		const fastInterval = setInterval(() => {
			if (progress < 90) {
				progress += Math.random() * 10;
			}
		}, 100);

		// Slow down approaching 90%
		const slowInterval = setInterval(() => {
			if (progress >= 90 && progress < 95) {
				progress += 0.5;
			}
		}, 500);

		return () => {
			clearInterval(fastInterval);
			clearInterval(slowInterval);
		};
	} else {
		// Navigation complete - jump to 100% then fade out
		if (visible) {
			progress = 100;
			setTimeout(() => {
				visible = false;
				progress = 0;
			}, 300);
		}
	}
});
</script>

{#if visible}
	<div
		class="fixed top-0 left-0 h-[3px] bg-primary z-progress transition-width duration-200 ease motion-reduce:transition-none"
		style="width: {progress}%; box-shadow: 0 0 8px var(--color-primary)"
		role="progressbar"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={Math.round(progress)}
		aria-label="Page loading progress"
	>
		<div class="absolute top-0 right-0 w-[100px] h-full opacity-50" style="background: linear-gradient(to right, transparent, var(--color-primary))"></div>
	</div>
{/if}
