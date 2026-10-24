<script lang="ts">
import { Pagination } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import type { PostListItem } from '#lib/server/blog/types.ts';
import { goto } from '$app/navigation';
import PostCard from './PostCard.svelte';

interface Props {
	posts: PostListItem[];
	page: number;
	totalPages: number;
	basePath?: string;
}

let { posts, page, totalPages, basePath = '/blog' }: Props = $props();

function handlePageChange(newPage: number) {
	const url = newPage === 1 ? basePath : `${basePath}?page=${newPage}`;
	goto(url);
}
</script>

<Stack class="gap-0">
	{#each posts as post (post.id)}
		<PostCard {post} />
	{/each}
</Stack>

{#if totalPages > 1}
	<Pagination
		currentPage={page}
		{totalPages}
		onPageChange={handlePageChange}
		class="mt-7"
	/>
{/if}
