<script lang="ts">
import { ToastContainer } from '#lib/components/shell/index.ts';

let { children } = $props();
</script>

{@render children?.()}

<ToastContainer />
