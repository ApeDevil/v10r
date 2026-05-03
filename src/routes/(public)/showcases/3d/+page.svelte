<script lang="ts">
import { pushState } from '$app/navigation';
import { page } from '$app/state';
import { SceneCard, ViewerDialog } from '$lib/components/3d';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { MODELS, MODELS_BY_ID } from '$lib/config/models';
import * as m from '$lib/paraglide/messages';

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
<PageContainer width="default" class="pt-7">
	<PageHeader
		title={m.showcase_3d_title()}
		description={m.showcase_3d_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_3d_breadcrumb() }
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

	<BackLink href="/showcases" label={m.showcase_breadcrumb_showcases()} />
</PageContainer>

{#if activeModel}
	<ViewerDialog
		model={activeModel}
		open={viewerOpen}
		onclose={closeViewer}
	/>
{/if}
