<script lang="ts">
import DocPage from '#lib/components/docs/DocPage.svelte';
import * as m from '#lib/paraglide/messages.js';
import { findWorkflow, workflowCategories } from '#lib/workflows/catalog.ts';

let { data } = $props();

// The card is client-safe catalog data, so its copy resolves in the reader's locale.
const card = $derived(findWorkflow(data.slug));
const category = $derived(workflowCategories.find((c) => c.id === card?.category));
</script>

{#if card}
	<DocPage
		entry={{ title: card.title(), description: card.description() }}
		html={data.html}
		toc={data.toc}
		breadcrumbs={[
			{ label: m.nav_home(), href: '/' },
			{ label: m.nav_workflows(), href: '/workflows' },
			...(category ? [{ label: category.label(), href: `/workflows#${category.id}` }] : []),
			{ label: card.title() },
		]}
		backHref="/workflows"
		backLabel={m.nav_workflows()}
	/>
{/if}
