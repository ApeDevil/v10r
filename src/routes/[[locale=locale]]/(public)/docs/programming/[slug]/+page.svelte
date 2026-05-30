<script lang="ts">
import Renderer from '$lib/components/blog/Renderer.svelte';
import { PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { data } = $props();
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title={data.agent.id}
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Docs', href: '/docs' },
			{ label: m.programming_page_title(), href: '/docs/programming' },
			{ label: data.agent.id },
		]}
	/>

	<div class="accent" data-color={data.agent.color ?? 'gray'} aria-hidden="true"></div>

	{#if data.agent.soul}
		<p class="soul">"{data.agent.soul}"</p>
	{/if}
	{#if data.agent.role}
		<p class="role">{data.agent.role}</p>
	{/if}

	<article class="prompt" aria-label={m.programming_view_prompt_aria({ name: data.agent.id })}>
		<Renderer html={data.html} />
	</article>

	<nav class="adjacent" aria-label="Adjacent agents">
		{#if data.prev}
			<a class="adj prev" href={localizeHref(`/docs/programming/${data.prev.id}`)}>
				<span class="i-lucide-arrow-left" aria-hidden="true"></span>
				<span class="adj-label">{m.programming_prev_agent()}</span>
				<span class="adj-id">{data.prev.id}</span>
			</a>
		{:else}
			<span></span>
		{/if}
		{#if data.next}
			<a class="adj next" href={localizeHref(`/docs/programming/${data.next.id}`)}>
				<span class="adj-label">{m.programming_next_agent()}</span>
				<span class="adj-id">{data.next.id}</span>
				<span class="i-lucide-arrow-right" aria-hidden="true"></span>
			</a>
		{/if}
	</nav>

	<a class="back" href={localizeHref('/docs/programming')}>← {m.programming_back_to_agents()}</a>
</PageContainer>

<style>
	.accent {
		width: 100%;
		height: 3px;
		border-radius: var(--radius-full);
		margin: 0 0 var(--spacing-5);
	}

	.accent[data-color='purple'] {
		background-color: var(--color-primary);
	}
	.accent[data-color='pink'] {
		background-color: var(--color-accent);
	}
	.accent[data-color='green'] {
		background-color: var(--color-success);
	}
	.accent[data-color='yellow'],
	.accent[data-color='amber'],
	.accent[data-color='orange'] {
		background-color: var(--color-warning);
	}
	.accent[data-color='blue'],
	.accent[data-color='cyan'] {
		background-color: var(--color-info);
	}
	.accent[data-color='red'] {
		background-color: var(--color-error);
	}
	.accent[data-color='gray'] {
		background-color: var(--color-muted);
	}

	.soul {
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-3);
		max-width: 65ch;
	}

	.role {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--color-muted);
		margin: 0 0 var(--spacing-7);
	}

	.prompt {
		max-width: 75ch;
	}

	.adjacent {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-4);
		margin-top: var(--spacing-8);
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
	}

	.adj {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background-color: var(--color-surface-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		text-decoration: none;
		color: inherit;
		min-height: 44px;
		transition:
			border-color 150ms,
			background-color 150ms;
	}

	.adj.next {
		justify-content: flex-end;
		text-align: right;
	}

	.adj:hover {
		border-color: var(--color-primary);
	}

	.adj:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.adj-label {
		font-size: var(--text-xs);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.adj-id {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.back {
		display: inline-block;
		margin-top: var(--spacing-7);
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.back:hover {
		text-decoration: underline;
	}

	@media (prefers-reduced-motion: reduce) {
		.adj {
			transition: none;
		}
	}
</style>
