<script lang="ts">
import { LatentCard, type LatentCardAction } from '#lib/components/composites/index.ts';
import type { ComponentDoc } from '#lib/components/composites/info-dialog/types.ts';
import { DemoCard } from '../../components/_components';

const latentCardDoc: ComponentDoc = {
	name: 'LatentCard',
	description:
		'A card whose actions rest neutral and take their colour when the card is engaged by hover, focus or a touch tap.',
	props: [
		{
			name: 'title',
			type: 'string',
			required: true,
			description: 'Card title; also names the article and the action group.',
		},
		{ name: 'eyebrow', type: 'string', description: 'Small line above the title.' },
		{ name: 'headingLevel', type: '2 | 3 | 4', default: '3', description: 'Heading level of the title.' },
		{
			name: 'actions',
			type: 'LatentCardAction[]',
			default: '[]',
			description: 'id, label, icon, href or onSelect, tone (neutral · primary · danger).',
		},
		{
			name: 'actionsPlacement',
			type: "'footer' | 'corner'",
			default: "'footer'",
			description: 'Labelled footer bar, or icon-only header cluster.',
		},
		{ name: 'actionsLabel', type: 'string', description: 'Accessible name of the action group.' },
		{ name: 'media', type: 'Snippet', description: 'Level 0 visual above the header.' },
		{ name: 'children', type: 'Snippet', description: 'Level 0 summary.' },
		{
			name: 'depth',
			type: 'Snippet',
			description: 'Level 2: a ScrollArea, Accordion or Carousel the user opens on purpose.',
		},
	],
	notes:
		'Hover engages only under `(hover: hover)`; `:focus-within` engages for the keyboard without script; a touch tap on the surface pins the card until an outside tap or Escape. Resting actions are never disabled. Pattern: `docs/blueprint/design/latent-cards.md`.',
};

let lastAction = $state('none yet');

function actionsFor(name: string): LatentCardAction[] {
	return [
		{
			id: 'open',
			label: 'Open',
			icon: 'i-lucide-arrow-up-right',
			tone: 'primary',
			onSelect: () => (lastAction = `Open ${name}`),
		},
		{ id: 'share', label: 'Share', icon: 'i-lucide-share-2', onSelect: () => (lastAction = `Share ${name}`) },
		{
			id: 'archive',
			label: 'Archive',
			icon: 'i-lucide-archive',
			tone: 'danger',
			onSelect: () => (lastAction = `Archive ${name}`),
		},
	];
}

const projects = [
	{
		name: 'Atlas',
		eyebrow: 'Project',
		summary: 'Customer portal rebuild. Twelve open tasks, two blocked on design review.',
	},
	{ name: 'Beacon', eyebrow: 'Project', summary: 'Notification service. Ships behind a flag next sprint.' },
	{ name: 'Cinder', eyebrow: 'Archive', summary: 'Legacy billing export, read-only since the migration.' },
];
</script>

<section id="cards-latent-actions" class="section">
	<h2 class="section-title">Latent Actions</h2>
	<p class="section-description">
		Every card offers the same three actions. At rest they sit neutral, in their final place,
		readable and enabled. Hover a card, tab into it, or tap its surface on a touch screen and the
		card engages: the actions take their colour. Nothing moves, nothing appears from nowhere, and
		a resting action still works on the first click.
	</p>

	<div class="demos">
		<DemoCard
			title="Footer actions"
			doc={latentCardDoc}
			description="Labelled actions in a bar at the bottom. Use when: the actions are the card's main way forward and their names matter."
		>
			<div class="card-grid">
				{#each projects as project (project.name)}
					<LatentCard title={project.name} eyebrow={project.eyebrow} actions={actionsFor(project.name)}>
						{project.summary}
					</LatentCard>
				{/each}
			</div>
			<p class="readout" aria-live="polite">Last action: <strong>{lastAction}</strong></p>
		</DemoCard>

		<DemoCard
			title="Corner actions"
			description="Icon-only actions in the header corner; the label is the accessible name and tooltip. Use when: the card is dense and the icons are familiar."
		>
			<div class="card-grid">
				{#each projects as project (project.name)}
					<LatentCard
						title={project.name}
						eyebrow={project.eyebrow}
						actions={actionsFor(project.name)}
						actionsPlacement="corner"
					>
						{project.summary}
					</LatentCard>
				{/each}
			</div>
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

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--spacing-4);
		width: 100%;
	}

	.readout {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
