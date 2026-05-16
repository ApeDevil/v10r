<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import * as m from '$lib/paraglide/messages';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/forms');
</script>

<ShowcaseLayout
	title={m.showcase_forms_title()}
	description={m.showcase_forms_description()}
	breadcrumbs={[
		{ label: m.showcase_breadcrumb_home(), href: '/' },
		{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
		{ label: m.showcase_forms_breadcrumb() }
	]}
	{tabs}
	ariaLabel="Form sections"
	wrapperClass="forms-showcase"
>
	{@render children()}
</ShowcaseLayout>

<style>
	/* Shared form styles for all leaf pages */
	:global(.forms-showcase .form-grid) {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	:global(.forms-showcase .form-actions) {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
	}


</style>
