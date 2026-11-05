<script lang="ts">
import type { Attribute } from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';

/**
 * An attribute of a kind this application does not know: shown, never edited. Its value is
 * kept exactly as it was written, so a newer application that knows the kind finds it intact.
 */
let { attribute }: { attribute: Attribute } = $props();

const preview = $derived(JSON.stringify(attribute.value).slice(0, 200));
</script>

<div class="unknown-control">
	<p class="text-fluid-sm text-muted">{m.attributes_unknown_kind({ kind: attribute.kind })}</p>
	<code class="text-fluid-xs">{preview}</code>
</div>

<style>
	.unknown-control {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		overflow-wrap: anywhere;
	}
</style>
