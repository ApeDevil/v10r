<script lang="ts">
import { page } from '$app/state';
import { PageContainer, Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';
import { Tag } from '$lib/components/primitives';
import { Renderer } from '$lib/components/blog';
import { formatDate } from '$lib/i18n/formatting';

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

		<Renderer html={post.revision.renderedHtml} embeds={post.revision.embedDescriptors} />

		<nav class="back-nav">
			<a href="/blog" class="back-link">
				<span class="i-lucide-arrow-left back-icon" aria-hidden="true"></span>
				All posts
			</a>
		</nav>
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

	.back-nav {
		padding-top: var(--spacing-4, 1rem);
		border-top: 1px solid var(--color-border);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--color-muted);
		text-decoration: none;
	}

	.back-link:hover {
		color: var(--color-primary);
	}

	.back-icon {
		width: 1em;
		height: 1em;
	}
</style>
