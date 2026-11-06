<script lang="ts">
/**
 * Latent Card — a card whose actions rest neutral and take their colour when the card
 * is engaged (hover, keyboard focus, or a touch tap on its surface).
 *
 * On touch screens the card nearest the screen's center engages as the user scrolls
 * (`center-engagement.ts`), so a list reads as one spotlight moving down the page.
 *
 * Three disclosure levels, one rule each:
 * - Level 0, the card (`media`, title, `children`): always shown.
 * - Level 1, the latent actions: always present and operable, emphasised on engagement.
 * - Level 2, the `depth` (a ScrollArea, Accordion or Carousel): opened only by a
 *   deliberate act. Engagement may hint at it; it never opens it.
 *
 * Pattern and rationale: docs/blueprint/design/latent-cards.md.
 */
import type { Snippet } from 'svelte';
import { Button } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { cn } from '#lib/utils/cn.ts';
import { trackCenterEngagement } from './center-engagement';
import {
	INTERACTIVE_SELECTOR,
	isSurfaceTap,
	type LatentActionPlacement,
	type LatentCardAction,
	nextPinned,
} from './latent-card';

interface Props {
	title: string;
	/** Small line above the title — a category, a type, a status. */
	eyebrow?: string;
	/** Heading level of the title, so the card fits the page outline. */
	headingLevel?: 2 | 3 | 4;
	actions?: LatentCardAction[];
	actionsPlacement?: LatentActionPlacement;
	/** Accessible name of the action group; defaults to "Actions for {title}". */
	actionsLabel?: string;
	/** Level 0 visual, full bleed above the header. */
	media?: Snippet;
	/** Level 0 summary. */
	children?: Snippet;
	/** Level 2 depth: content the user opens or scrolls on purpose. */
	depth?: Snippet;
	/**
	 * On touch screens, engage this card while it is the one nearest the screen's center
	 * as the user scrolls. Turn off for a card that stands alone.
	 */
	engageAtCenter?: boolean;
	class?: string;
}

let {
	title,
	eyebrow,
	headingLevel = 3,
	actions = [],
	actionsPlacement = 'footer',
	actionsLabel,
	media,
	children,
	depth,
	engageAtCenter = true,
	class: className,
}: Props = $props();

const id = $props.id();
const titleId = `${id}-title`;

let card = $state<HTMLElement | null>(null);
let pinned = $state(false);
let centered = $state(false);

$effect(() => {
	if (!card || !engageAtCenter) return;
	return trackCenterEngagement(card, (value) => (centered = value));
});

function onPointerDown(event: PointerEvent) {
	const target = event.target as Element | null;
	const onControl = target?.closest(INTERACTIVE_SELECTOR) != null && target !== card;
	if (isSurfaceTap(event.pointerType, onControl)) pinned = nextPinned(pinned, 'surface-tap');
}

function onKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && pinned) pinned = nextPinned(pinned, 'escape');
}

// A pinned card releases when the user taps anywhere else.
$effect(() => {
	if (!pinned) return;
	const release = (event: PointerEvent) => {
		if (card && !card.contains(event.target as Node)) pinned = nextPinned(pinned, 'outside-tap');
	};
	document.addEventListener('pointerdown', release);
	return () => document.removeEventListener('pointerdown', release);
});
</script>

{#snippet actionGroup()}
	<div
		class="latent-actions"
		data-placement={actionsPlacement}
		role="group"
		aria-label={actionsLabel ?? m.composites_latent_card_actions_aria({ title })}
	>
		{#each actions as action (action.id)}
			{@const iconOnly = actionsPlacement === 'corner' && action.icon}
			<Button
				variant="ghost"
				size={iconOnly ? 'icon' : 'sm'}
				href={action.href}
				type={action.href ? undefined : 'button'}
				class="latent-action"
				data-tone={action.tone ?? 'neutral'}
				aria-label={iconOnly ? action.label : undefined}
				title={iconOnly ? action.label : undefined}
				onclick={action.onSelect}
			>
				{#if action.icon}
					<span class={cn(action.icon, 'latent-action-icon')} aria-hidden="true"></span>
				{/if}
				{#if !iconOnly}
					<span>{action.label}</span>
				{/if}
			</Button>
		{/each}
	</div>
{/snippet}

<!-- The pointer and key handlers only manage the touch pin; every action is its own
     control, so the article itself needs no role. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
	bind:this={card}
	class={cn('latent-card', className)}
	data-pinned={pinned || undefined}
	data-centered={centered || undefined}
	aria-labelledby={titleId}
	onpointerdown={onPointerDown}
	onkeydown={onKeyDown}
>
	{#if media}
		<div class="latent-media">
			{@render media()}
		</div>
	{/if}

	<header class="latent-header">
		<div class="latent-heading">
			{#if eyebrow}
				<p class="latent-eyebrow">{eyebrow}</p>
			{/if}
			<svelte:element this={`h${headingLevel}`} id={titleId} class="latent-title">
				{title}
			</svelte:element>
		</div>
		{#if actions.length > 0 && actionsPlacement === 'corner'}
			{@render actionGroup()}
		{/if}
	</header>

	{#if children}
		<div class="latent-summary">
			{@render children()}
		</div>
	{/if}

	{#if depth}
		<div class="latent-depth">
			{@render depth()}
		</div>
	{/if}

	{#if actions.length > 0 && actionsPlacement === 'footer'}
		<footer class="latent-footer">
			{@render actionGroup()}
		</footer>
	{/if}
</article>

<style>
	.latent-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		box-shadow: var(--shadow-sm);
		transition:
			border-color var(--duration-fast) var(--ease-default),
			box-shadow var(--duration-fast) var(--ease-default);
	}

	.latent-media {
		overflow: hidden;
	}

	.latent-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-3);
		padding: var(--spacing-4) var(--spacing-4) 0;
	}

	.latent-heading {
		min-width: 0;
	}

	.latent-eyebrow {
		margin: 0 0 var(--spacing-1);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.latent-title {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.latent-summary {
		padding: var(--spacing-2) var(--spacing-4) 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.55;
		color: var(--color-muted);
	}

	.latent-depth {
		margin: var(--spacing-3) var(--spacing-4) 0;
		border-top: 1px dashed var(--color-border);
		padding-top: var(--spacing-2);
		transition: border-color var(--duration-fast) var(--ease-default);
	}

	.latent-footer {
		margin-top: auto;
		padding: var(--spacing-3) var(--spacing-2) var(--spacing-2);
	}

	.latent-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	.latent-actions[data-placement='corner'] {
		flex-wrap: nowrap;
		margin: calc(var(--spacing-2) * -1) calc(var(--spacing-2) * -1) 0 0;
	}

	/* ── Level 1 at rest: neutral, legible, enabled ─────────────────────────
	   Muted text, no fill, no accent. Never opacity or a disabled look: a
	   resting action must read as available and meet text contrast. */
	.latent-card :global(.latent-action) {
		gap: var(--spacing-2);
		color: var(--color-muted);
		background: transparent;
		transition:
			color var(--duration-fast) var(--ease-default),
			background-color var(--duration-fast) var(--ease-default);
	}

	.latent-card :global(.latent-action-icon) {
		width: 1rem;
		height: 1rem;
	}

	/* ── Engaged: hover (only where hover exists), focus inside, touch pin,
	   and on touch screens the card nearest the screen's center ─────────── */
	@media (hover: hover) {
		.latent-card:hover {
			border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
			box-shadow: var(--shadow-md);
		}

		.latent-card:hover :global(.latent-action) {
			color: var(--color-fg);
		}

		.latent-card:hover :global(.latent-action[data-tone='primary']) {
			color: var(--color-primary);
		}

		.latent-card:hover :global(.latent-action[data-tone='danger']) {
			color: var(--color-error);
		}

		.latent-card:hover .latent-depth {
			border-top-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
		}
	}

	.latent-card:focus-within,
	.latent-card[data-pinned],
	.latent-card[data-centered] {
		border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
		box-shadow: var(--shadow-md);
	}

	.latent-card:focus-within :global(.latent-action),
	.latent-card[data-pinned] :global(.latent-action),
	.latent-card[data-centered] :global(.latent-action) {
		color: var(--color-fg);
	}

	.latent-card:focus-within :global(.latent-action[data-tone='primary']),
	.latent-card[data-pinned] :global(.latent-action[data-tone='primary']),
	.latent-card[data-centered] :global(.latent-action[data-tone='primary']) {
		color: var(--color-primary);
	}

	.latent-card:focus-within :global(.latent-action[data-tone='danger']),
	.latent-card[data-pinned] :global(.latent-action[data-tone='danger']),
	.latent-card[data-centered] :global(.latent-action[data-tone='danger']) {
		color: var(--color-error);
	}

	.latent-card:focus-within .latent-depth,
	.latent-card[data-pinned] .latent-depth,
	.latent-card[data-centered] .latent-depth {
		border-top-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
	}

	/* The engaged action under the pointer or focus gets a quiet fill. */
	.latent-card :global(.latent-action:hover),
	.latent-card :global(.latent-action:focus-visible) {
		background: var(--color-subtle);
	}

	@media (prefers-reduced-motion: reduce) {
		.latent-card,
		.latent-depth,
		.latent-card :global(.latent-action) {
			transition: none;
		}

		.latent-card :global(.latent-action:hover) {
			translate: none;
		}
	}
</style>
