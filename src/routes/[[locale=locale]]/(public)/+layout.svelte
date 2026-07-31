<script lang="ts">
import { FeedbackBand } from '$lib/components/composites';
import { AppShell } from '$lib/components/shell';

let { children, data } = $props();
</script>

<AppShell session={data.session} isAdmin={data.isAdmin} announcements={data.announcements}>
	{@render children()}
	<FeedbackBand />
</AppShell>
