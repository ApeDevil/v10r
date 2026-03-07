<script lang="ts">
	import { Typography } from '$lib/components';
	import type { FontLoadState } from '$lib/utils/fonts';

	interface Props {
		mode: 'single' | 'pairing';
		fontStack: string;
		headingFontStack: string;
		bodyFontStack: string;
		loadState: FontLoadState;
		headingLoadState: FontLoadState;
		bodyLoadState: FontLoadState;
	}

	let { mode, fontStack, headingFontStack, bodyFontStack, loadState, headingLoadState, bodyLoadState }: Props = $props();

	function headingStyle(): string | undefined {
		if (mode === 'single') return undefined;
		return headingFontStack;
	}

	function bodyStyle(): string | undefined {
		if (mode === 'single') return undefined;
		return bodyFontStack;
	}

	let headingLoading = $derived(mode === 'single' ? loadState === 'loading' : headingLoadState === 'loading');
	let bodyLoading = $derived(mode === 'single' ? loadState === 'loading' : bodyLoadState === 'loading');
</script>

<article class="prose" style:font-family={mode === 'single' ? fontStack : undefined}>
	<div class="heading-wrap" class:loading={headingLoading} style:font-family={headingStyle()}>
		<Typography variant="h1">The Art of Typography</Typography>
	</div>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="lead">
			Typography is the craft of arranging type to make written language legible, readable, and visually compelling. It shapes how we perceive information before we read a single word.
		</Typography>
	</div>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="body">
			Good typography is invisible. When type is set well, the reader is absorbed in the content, not distracted by the presentation. The choice of typeface, the measure of a line, the spacing between letters and words — these decisions compound into an experience that either invites reading or repels it.
		</Typography>
	</div>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="body">
			The relationship between heading and body typefaces is one of contrast and harmony. A high-contrast serif headline paired with a neutral sans-serif body creates visual hierarchy without friction. The heading demands attention; the body rewards it with comfort.
		</Typography>
	</div>

	<div class="heading-wrap" class:loading={headingLoading} style:font-family={headingStyle()}>
		<Typography variant="h2">Choosing the Right Typeface</Typography>
	</div>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="body">
			Every typeface carries associations. Geometric sans-serifs suggest precision and modernity. Humanist serifs evoke warmth and tradition. Display faces project personality and energy. The right choice depends not just on aesthetics but on context: who is reading, on what device, and for how long.
		</Typography>
	</div>

	<blockquote class="quote" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="lead">
			"Typography is two-dimensional architecture, based on experience and imagination, and guided by rules and readability."
		</Typography>
		<Typography variant="muted">— Hermann Zapf</Typography>
	</blockquote>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="body">
			Variable fonts have transformed what is possible on the web. A single font file can now express a continuous range of weights, widths, and optical sizes. This means fewer network requests, smoother animations, and more precise typographic control — all from one resource.
		</Typography>
	</div>

	<div class="heading-wrap" class:loading={headingLoading} style:font-family={headingStyle()}>
		<Typography variant="h3">Hierarchy and Contrast</Typography>
	</div>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="body">
			A well-designed type scale establishes a clear visual hierarchy. Headings set in a display face at larger sizes signal structure. Body text set at comfortable reading sizes — typically 16 to 20 pixels — provides the content. Lead text bridges the two, offering a slightly larger, lighter introduction that eases the reader into the body.
		</Typography>
	</div>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="body">
			The measure — the length of a line of text — directly affects readability. Too wide and the eye loses its place returning to the next line. Too narrow and the text feels fragmented. The ideal measure for body text falls between 45 and 75 characters, with 65 characters often cited as optimal.
		</Typography>
	</div>

	<div class="body-wrap" class:loading={bodyLoading} style:font-family={bodyStyle()}>
		<Typography variant="muted">
			This preview uses your selected fonts to demonstrate how they work together in long-form content. Switch between font pairings to compare how different combinations feel at reading length.
		</Typography>
	</div>
</article>

<style>
	.prose {
		max-width: 65ch;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.heading-wrap {
		margin-top: var(--spacing-4);
		transition: opacity var(--duration-fast);
	}

	.heading-wrap:first-child {
		margin-top: 0;
	}

	.body-wrap {
		transition: opacity var(--duration-fast);
	}

	.loading {
		opacity: 0.5;
	}

	.quote {
		margin: var(--spacing-4) 0;
		padding-left: var(--spacing-5);
		border-left: 3px solid var(--color-primary);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		transition: opacity var(--duration-fast);
	}
</style>
