<script lang="ts">
import { AppShell } from '$lib/components/shell';

let { children, data } = $props();
</script>

<AppShell session={data.session} isAdmin={data.isAdmin}>
	{@render children()}
</AppShell>
