<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import * as m from '$lib/paraglide/messages';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/shell');
</script>

<ShowcaseLayout
	title={m.showcase_shell_layout_title()}
	description={m.showcase_shell_layout_description()}
	breadcrumbs={[
		{ label: m.showcase_breadcrumb_home(), href: '/' },
		{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
		{ label: m.showcase_shell_layout_breadcrumb() }
	]}
	{tabs}
	ariaLabel={m.showcase_shell_layout_aria()}
>
	{@render children()}
</ShowcaseLayout>
