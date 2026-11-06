<script lang="ts">
import { DemoCard } from '../../components/_components';

const rules = [
	{
		rule: 'Rest is neutral, not disabled',
		why: 'Muted text, no fill, no accent; never opacity or a disabled look. A resting action meets text contrast and works on the first click.',
	},
	{
		rule: 'Engagement changes emphasis, never capability',
		why: 'Hover, focus and a touch tap all lead to the same engaged look. No action exists only on hover.',
	},
	{
		rule: 'Nothing moves',
		why: 'Actions hold their place at rest and when engaged, so a grid of cards never reflows and the pointer never chases a target.',
	},
	{
		rule: 'Hover hints, a deliberate act opens',
		why: 'Level 2 depth opens by click, scroll or keyboard. Hover-opened content fires by accident and breaks on touch.',
	},
	{
		rule: 'Hover only where hover exists',
		why: 'Hover styles sit under (hover: hover). On touch, the card nearest the screen center engages as you scroll; tapping a card surface pins it, a tap elsewhere or Escape releases it.',
	},
	{
		rule: 'Keyboard is first-class',
		why: ':focus-within engages the card as soon as focus enters, before hydration, with no script.',
	},
];
</script>

<section id="cards-rules" class="section">
	<h2 class="section-title">Rules</h2>
	<p class="section-description">
		Latent Cards are Explosive Discovery at the scale of one card: capability stays complete, and
		only the emphasis follows the user's intent.
	</p>

	<div class="demos">
		<DemoCard title="The six rules">
			<dl class="rules">
				{#each rules as item (item.rule)}
					<div class="rule">
						<dt>{item.rule}</dt>
						<dd>{item.why}</dd>
					</div>
				{/each}
			</dl>
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.rules {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--spacing-4);
		width: 100%;
	}

	.rule dt {
		font-weight: 600;
		color: var(--color-fg);
	}

	.rule dd {
		margin: var(--spacing-1) 0 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.55;
		color: var(--color-muted);
	}
</style>
