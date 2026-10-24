<script lang="ts">
import { FeedbackBand } from '#lib/components/composites/feedback-band/index.ts';
import AppShell from '#lib/components/shell/AppShell.svelte';

let { children, data } = $props();
</script>

<AppShell session={data.session} isAdmin={data.isAdmin} announcements={data.announcements}>
	{@render children()}
	<FeedbackBand />
</AppShell>
