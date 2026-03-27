<script lang="ts">
import { PageContainer, Stack } from '$lib/components/layout';
import { PageHeader, EmptyState } from '$lib/components/composites';
import { PostList } from '$lib/components/blog';

let { data } = $props();
</script>

<svelte:head>
	<title>Blog - Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7 pb-8">
	<Stack class="gap-7">
		<PageHeader
			title="Blog"
			description="Thoughts, tutorials, and updates."
			breadcrumbs={[
				{ label: 'Home', href: '/' },
				{ label: 'Blog' },
			]}
		/>

		{#if data.posts.length > 0}
			<PostList
				posts={data.posts}
				page={data.page}
				totalPages={data.totalPages}
			/>
		{:else}
			<EmptyState
				icon="i-lucide-newspaper"
				title="No posts yet"
				description="Published posts will appear here."
			/>
		{/if}
	</Stack>
</PageContainer>
