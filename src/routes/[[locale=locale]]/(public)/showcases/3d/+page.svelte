<script lang="ts">
import { MODELS, MODELS_BY_ID } from '#lib/3d/models.ts';
import { SceneCard, ViewerDialog } from '#lib/components/3d/index.ts';
import { BackLink, NavGrid, PageHeader, ShowcaseDocs } from '#lib/components/composites/index.ts';
import { PageContainer } from '#lib/components/layout/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { goto } from '$app/navigation';
import { page } from '$app/state';

const activeModel = $derived(page.state.modelId ? MODELS_BY_ID.get(page.state.modelId) : undefined);

let viewerOpen = $derived(!!page.state.viewerOpen);

function openViewer(modelId: string) {
	// Shallow: the URL names the model (a shareable link to /showcases/3d/[model]) while the
	// viewer opens over this page instead of loading that one.
	void goto(localizeHref(`/showcases/3d/${modelId}`), { shallow: true, state: { viewerOpen: true, modelId } });
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
			{ label: m.showcase_3d_title() }
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<NavGrid>
		{#each MODELS as model (model.id)}
			<SceneCard
				{model}
				paused={viewerOpen}
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
