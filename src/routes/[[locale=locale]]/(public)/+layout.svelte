<script lang="ts">
import { AppShell } from '$lib/components/shell';

let { children, data } = $props();
</script>

<AppShell session={data.session} isAdmin={data.isAdmin} announcements={data.announcements}>
	{@render children()}
</AppShell>
