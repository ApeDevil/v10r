<script lang="ts">
import { pushState } from '$app/navigation';
import { page } from '$app/state';
import { SceneCard, ViewerDialog } from '$lib/components/3d';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { MODELS, MODELS_BY_ID } from '$lib/config/models';

const activeModel = $derived(page.state.modelId ? MODELS_BY_ID.get(page.state.modelId) : undefined);

let viewerOpen = $derived(!!page.state.viewerOpen);

function openViewer(modelId: string) {
	pushState(`/showcases/3d/${modelId}`, {
		viewerOpen: true,
		modelId,
	});
}

function closeViewer() {
	history.back();
}
</script>

<svelte:head>
	<title>3D Showcase - Velociraptor</title>
</svelte:head>

<PageContainer width="default" class="pt-7">
	<PageHeader
		title="3D Showcase"
		description="Three.js + Threlte 3D demonstrations with GLTF models, animations, and interactive controls."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: '3D' }
		]}
	/>

	<NavGrid>
		{#each MODELS as model (model.id)}
			<SceneCard
				{model}
				onclick={() => openViewer(model.id)}
			/>
		{/each}
	</NavGrid>

	<BackLink href="/showcases" label="Showcases" />
</PageContainer>

{#if activeModel}
	<ViewerDialog
		model={activeModel}
		open={viewerOpen}
		onclose={closeViewer}
	/>
{/if}
