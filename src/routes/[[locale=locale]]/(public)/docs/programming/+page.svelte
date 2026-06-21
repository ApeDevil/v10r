<script lang="ts">
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

const BUCKET_LABEL: Record<string, () => string> = {
	'architecture-data': m.programming_bucket_architecture_data,
	'runtime-quality': m.programming_bucket_runtime_quality,
	'interface-words': m.programming_bucket_interface_words,
	'intelligence-trust': m.programming_bucket_intelligence_trust,
};
</script>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title={m.programming_page_title()}
		description={m.programming_page_description()}
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Docs', href: '/docs' },
			{ label: m.programming_page_title() },
		]}
	/>

	<p class="lead">{m.programming_lead()}</p>

	{#each data.buckets as bucket (bucket.id)}
		<section class="bucket">
			<h2>{BUCKET_LABEL[bucket.id]()}</h2>
			<div class="grid">
				{#each bucket.agents as agent (agent.id)}
					<a
						class="agent-card"
						href={localizeHref(`/docs/programming/${agent.id}`)}
						aria-label={m.programming_view_prompt_aria({ name: agent.id })}
					>
						<div class="head">
							<span class="dot" data-color={agent.color ?? 'gray'} aria-hidden="true"></span>
							<span class="id">{agent.id}</span>
							<span class="arrow i-lucide-arrow-right" aria-hidden="true"></span>
						</div>
						{#if agent.soul}
							<p class="soul">{agent.soul}</p>
						{:else if agent.role}
							<p class="soul">{agent.role}</p>
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/each}

	<BackLink href="/docs" label="Docs" />
</PageContainer>

<style>
	.lead {
		max-width: 65ch;
		color: var(--color-body);
		font-size: var(--text-base);
		line-height: 1.6;
		margin: 0 0 var(--spacing-7);
	}

	.bucket {
		margin-bottom: var(--spacing-7);
	}

	.bucket h2 {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0 0 var(--spacing-4);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-5);
	}

	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.agent-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		min-height: 4.5rem;
		padding: var(--spacing-5) var(--spacing-4);
		background-color: var(--surface-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		text-decoration: none;
		color: inherit;
		transition:
			border-color 150ms,
			box-shadow 150ms,
			transform 150ms;
	}

	.agent-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.08);
		transform: translateY(-1px);
	}

	.agent-card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.dot[data-color='purple'] {
		background-color: var(--color-primary);
	}
	.dot[data-color='pink'] {
		background-color: var(--color-accent);
	}
	.dot[data-color='green'] {
		background-color: var(--color-success);
	}
	.dot[data-color='yellow'],
	.dot[data-color='amber'],
	.dot[data-color='orange'] {
		background-color: var(--color-warning);
	}
	.dot[data-color='blue'],
	.dot[data-color='cyan'] {
		background-color: var(--color-info);
	}
	.dot[data-color='red'] {
		background-color: var(--color-error);
	}
	.dot[data-color='gray'] {
		background-color: var(--color-muted);
	}

	.id {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-fg);
		flex: 1;
	}

	.arrow {
		font-size: 1rem;
		color: var(--color-muted);
		opacity: 0;
		transition: opacity 150ms;
	}

	.agent-card:hover .arrow,
	.agent-card:focus-visible .arrow {
		opacity: 1;
	}

	.soul {
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-body);
		margin: 0;
		line-height: 1.4;
	}

	@media (prefers-reduced-motion: reduce) {
		.agent-card,
		.arrow {
			transition: none;
		}
		.agent-card:hover {
			transform: none;
		}
	}
</style>
