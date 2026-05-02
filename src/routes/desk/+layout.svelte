<script lang="ts">
import { AppShell } from '$lib/components/shell';

let { children, data } = $props();
</script>

<AppShell session={data.session} immersive announcements={data.announcements}>
	{@render children()}
</AppShell>
