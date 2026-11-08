<script lang="ts">
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';
import { Alert, NavTab, PageHeader } from '#lib/components/composites/index.ts';
import { PageContainer } from '#lib/components/layout/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { findStudioArea, studioAreaHref, studioModeHref } from '#lib/studio/catalog.ts';
import { noticeText } from './_components/notice-text.ts';
import { browserStorage, createArchitectureDraftStore } from './_state/architecture-drafts.ts';
import { createArchitectureStudio, provideArchitectureStudio } from './_state/architecture-studio.svelte.ts';

let { children }: { children: Snippet } = $props();

const area = findStudioArea('architecture');
const studio = provideArchitectureStudio(
	createArchitectureStudio({ store: createArchitectureDraftStore(browserStorage) }),
);

const tabs = $derived(
	area
		? [
				{ label: m.studio_area_overview(), href: studioAreaHref(area), icon: 'i-lucide-book-open', exact: true },
				...area.modes.map((mode) => ({ label: mode.label(), href: studioModeHref(area, mode), icon: mode.icon })),
			]
		: [],
);

onMount(() => {
	studio.hydrate();
});
</script>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		compact
		title={m.studio_architecture_title()}
		description={m.studio_architecture_tagline()}
		breadcrumbs={[{ label: m.nav_home(), href: '/' }, { label: m.nav_studio(), href: '/studio' }, { label: m.studio_architecture_title() }]}
	/>

	<NavTab {tabs} ariaLabel={m.studio_architecture_modes_aria()} />

	{#if studio.notice}
		{#key studio.notice}
		<div class="notice" aria-live="polite">
			<Alert
				variant={studio.notice.tone === 'error' ? 'error' : studio.notice.tone === 'success' ? 'success' : 'info'}
				description={noticeText(studio.notice.text)}
				closable
				onclose={() => studio.dismissNotice()}
			>
				{#if studio.notice.issues && studio.notice.issues.length > 0}
					<ul class="issues">
						{#each studio.notice.issues as issue}
							<li><code>{issue.path || '/'}</code> {issue.message}</li>
						{/each}
					</ul>
				{/if}
			</Alert>
		</div>
		{/key}
	{/if}

	<div class="mode-body">
		{@render children()}
	</div>
</PageContainer>

<style>
	.notice {
		margin-block: var(--spacing-4) 0;
	}

	.issues {
		margin: var(--spacing-2) 0 0;
		padding-left: var(--spacing-5);
		font-size: var(--text-fluid-sm);
	}

	.mode-body {
		padding-block: var(--spacing-6);
	}
</style>
