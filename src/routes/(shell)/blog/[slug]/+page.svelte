<script lang="ts">
import { page } from '$app/state';
import { PageContainer, Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';
import { Tag } from '$lib/components/primitives';
import { Renderer } from '$lib/components/blog';
import { formatDate } from '$lib/i18n/formatting';
import { hydrateEmbeds } from '$lib/actions/hydrate-embeds';

let { data } = $props();

const post = $derived(data.post);

const jsonLd = $derived({
	'@context': 'https://schema.org',
	'@type': 'BlogPosting',
	headline: post.revision.title,
	description: post.revision.summary ?? undefined,
	datePublished: post.publishedAt.toISOString(),
	dateModified: post.revision.createdAt.toISOString(),
	author: {
		'@type': 'Person',
		name: post.author.name,
	},
	publisher: {
		'@type': 'Organization',
		name: 'Velociraptor',
	},
});

const jsonLdScript = $derived(
	`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')}<\/script>`
);
</script>

<svelte:head>
	<title>{post.revision.title} - Velociraptor</title>
	{#if post.revision.summary}
		<meta name="description" content={post.revision.summary} />
	{/if}
	<link rel="canonical" href={page.url.href} />

	<meta property="og:title" content={post.revision.title} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={page.url.href} />
	{#if post.revision.summary}
		<meta property="og:description" content={post.revision.summary} />
	{/if}
	<meta property="article:published_time" content={post.publishedAt.toISOString()} />
	{#each post.tags as t (t.id)}
		<meta property="article:tag" content={t.name} />
	{/each}

	{@html jsonLdScript}
</svelte:head>

<PageContainer width="content" class="pt-7 pb-8">
	<Stack class="gap-7">
		<nav class="breadcrumbs" aria-label="Breadcrumb">
			<ol>
				<li><a href="/">Home</a><span class="sep" aria-hidden="true">/</span></li>
				<li><a href="/blog">Blog</a><span class="sep" aria-hidden="true">/</span></li>
				<li><span aria-current="page">{post.revision.title}</span></li>
			</ol>
		</nav>

		<header class="post-header">
			<Typography variant="h1">{post.revision.title}</Typography>

			<div class="post-meta">
				<span class="post-author">
					{#if post.author.image}
						<img
							src={post.author.image}
							alt={post.author.name}
							class="author-avatar"
							width="24"
							height="24"
						/>
					{/if}
					{post.author.name}
				</span>
				<span class="meta-sep" aria-hidden="true">&middot;</span>
				<time datetime={post.publishedAt.toISOString()}>
					{formatDate(post.publishedAt)}
				</time>
			</div>

			{#if post.tags.length > 0}
				<div class="post-tags">
					{#each post.tags as t (t.id)}
						<a href="/blog/tag/{t.slug}" class="tag-link">
							<Tag label={t.name} size="sm" variant="muted" />
						</a>
					{/each}
				</div>
			{/if}
		</header>

		<div use:hydrateEmbeds={post.revision.embedDescriptors ?? []}>
			<Renderer html={post.revision.renderedHtml} embeds={post.revision.embedDescriptors} />
		</div>

	</Stack>
</PageContainer>

<style>
	.post-header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3, 0.5rem);
	}

	.post-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--color-muted);
	}

	.post-author {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.author-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		object-fit: cover;
	}

	.meta-sep {
		opacity: 0.5;
	}

	.post-tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1, 0.25rem);
	}

	.tag-link {
		text-decoration: none;
	}

	.breadcrumbs ol {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		margin: 0;
		padding: 0;
		gap: var(--spacing-2);
	}

	.breadcrumbs li {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.breadcrumbs a {
		color: var(--color-primary);
		text-decoration: none;
		transition: color var(--duration-fast);
	}

	.breadcrumbs a:hover {
		color: var(--color-primary-hover);
		text-decoration: underline;
	}

	.breadcrumbs a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.breadcrumbs span[aria-current] {
		color: var(--color-muted);
		font-weight: 500;
	}

	.sep {
		color: var(--color-muted);
		user-select: none;
	}
</style>
