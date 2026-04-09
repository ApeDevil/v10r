<script lang="ts">
import { PostList } from '$lib/components/blog';
import { EmptyState, PageHeader } from '$lib/components/composites';
import { PageContainer, Stack } from '$lib/components/layout';

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
