<script lang="ts">
import { Alert } from '#lib/components/composites/index.ts';
import { BackLink, PageHeader, ShowcaseDocs } from '#lib/components/index.ts';
import * as m from '#lib/paraglide/messages.js';
import ProduceView from './_components/ProduceView.svelte';
</script>

<div class="page">
	<PageHeader
		title={m.showcase_3d_produce_title()}
		description={m.showcase_3d_produce_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_3d_breadcrumb(), href: '/showcases/3d' },
			{ label: m.showcase_3d_produce_breadcrumb() },
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<Alert variant="info" title={m.showcase_3d_produce_scope_title()} description={m.showcase_3d_produce_scope_body()} />

	<ProduceView />

	<BackLink href="/showcases/3d" label={m.showcase_3d_breadcrumb()} />
</div>

<style>
	.page {
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}
</style>
