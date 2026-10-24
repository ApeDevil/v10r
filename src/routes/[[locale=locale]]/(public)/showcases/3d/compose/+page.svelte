<script lang="ts">
import { CompositionEditor } from '#lib/components/3d/composition/index.ts';
import { Alert } from '#lib/components/composites/index.ts';
import { BackLink, PageHeader, ShowcaseDocs } from '#lib/components/index.ts';
import { ToggleGroup } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { createPortStandardRegistry } from '#lib/product-composition/index.ts';
import {
	HEATING_COMPOSITION,
	HEATING_CONDUIT_SURFACES,
	HEATING_ROOM,
	HEATING_STANDARDS,
} from '#lib/showcases/3d/compose/heating.ts';
import { SHELVING_COMPOSITION, SHELVING_ROOM, SHELVING_STANDARDS } from '#lib/showcases/3d/compose/shelving.ts';
import ComposeView from './_components/ComposeView.svelte';

/** One editor per catalogue, kept for the page's life: switching back finds the work and its undo intact. */
const FIXTURES = {
	heating: {
		editor: new CompositionEditor(HEATING_COMPOSITION, createPortStandardRegistry(HEATING_STANDARDS)),
		standards: HEATING_STANDARDS,
		room: HEATING_ROOM,
		conduitSurfaces: HEATING_CONDUIT_SURFACES,
	},
	shelving: {
		editor: new CompositionEditor(SHELVING_COMPOSITION, createPortStandardRegistry(SHELVING_STANDARDS)),
		standards: SHELVING_STANDARDS,
		room: SHELVING_ROOM,
	},
};

let fixture = $state<keyof typeof FIXTURES>('heating');
</script>

<div class="page">
	<PageHeader
		title={m.showcase_3d_compose_title()}
		description={m.showcase_3d_compose_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_3d_breadcrumb(), href: '/showcases/3d' },
			{ label: m.showcase_3d_compose_breadcrumb() },
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<Alert
		variant="warning"
		title={m.showcase_3d_compose_plausibility_title()}
		description={m.showcase_3d_compose_plausibility_body()}
	/>

	<div class="fixture">
		<span class="fixture-label" id="compose-fixture-label">{m.showcase_3d_compose_fixture_label()}</span>
		<div role="group" aria-labelledby="compose-fixture-label">
			<ToggleGroup
				bind:value={() => fixture, (value) => (fixture = value === 'shelving' ? 'shelving' : 'heating')}
				size="sm"
				items={[
					{ value: 'heating', label: m.showcase_3d_compose_fixture_heating() },
					{ value: 'shelving', label: m.showcase_3d_compose_fixture_shelving() },
				]}
			/>
		</div>
	</div>

	<!-- Each catalogue keeps its editor; the view remounts so the camera frames the new scene. -->
	{#key fixture}
		<ComposeView {...FIXTURES[fixture]} />
	{/key}

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

	.fixture {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.fixture-label {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}
</style>
