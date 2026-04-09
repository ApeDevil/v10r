<script lang="ts">
import { BlogTag } from '$lib/components/blog';
import { formatDate } from '$lib/i18n/formatting';
import type { PostListItem } from '$lib/server/blog/types';

interface Props {
	post: PostListItem;
}

let { post }: Props = $props();
</script>

<article class="post-card">
	<a href="/blog/{post.slug}" class="post-link">
		<h2 class="post-title">{post.title}</h2>
		{#if post.summary}
			<p class="post-summary">{post.summary}</p>
		{/if}
	</a>

	<div class="post-meta">
		<span class="post-meta-text">
			{#if post.authorName}
				<span>{post.authorName}</span>
				<span class="meta-sep" aria-hidden="true">&middot;</span>
			{/if}
			{#if post.publishedAt}
				<time datetime={post.publishedAt.toISOString()}>
					{formatDate(post.publishedAt)}
				</time>
			{/if}
		</span>

		{#if post.domain || post.tags.length > 0}
			<div class="post-tags">
				{#if post.domain}
					<a
						href="/blog/domain/{post.domain.slug}"
						class="tag-link"
						onclick={(e) => e.stopPropagation()}
					>
						<BlogTag tag={post.domain} tier="domain" />
					</a>
				{/if}
				{#each post.tags.slice(0, 2) as t (t.id)}
					<a
						href="/blog/tag/{t.slug}"
						class="tag-link"
						onclick={(e) => e.stopPropagation()}
					>
						<BlogTag tag={t} tier="category" />
					</a>
				{/each}
				{#if post.tags.length > 2}
					<span class="tag-overflow">+{post.tags.length - 2}</span>
				{/if}
			</div>
		{/if}
	</div>
</article>

<style>
	.post-card {
		padding: var(--spacing-6, 1.5rem) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.post-card:first-child {
		padding-top: 0;
	}

	.post-card:last-child {
		border-bottom: none;
	}

	.post-link {
		display: block;
		text-decoration: none;
		color: inherit;
	}

	.post-link:hover .post-title {
		color: var(--color-primary);
	}

	.post-title {
		font-family: var(--font-heading);
		color: var(--color-heading);
		font-size: 1.25rem;
		font-weight: 600;
		line-height: 1.3;
		margin: 0 0 0.375rem;
	}

	.post-summary {
		color: var(--color-muted);
		font-size: 0.9375rem;
		line-height: 1.6;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.post-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-3, 0.5rem);
		margin-top: var(--spacing-3, 0.5rem);
	}

	.post-meta-text {
		font-size: 0.8125rem;
		color: var(--color-muted);
		display: flex;
		align-items: center;
		gap: 0.375rem;
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
		position: relative;
		z-index: 1;
	}

	.tag-overflow {
		font-size: 0.75rem;
		color: var(--color-muted);
		align-self: center;
	}
</style>
