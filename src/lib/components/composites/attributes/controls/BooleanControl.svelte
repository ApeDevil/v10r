<script lang="ts">
import { Switch } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { AttributeControlProps } from '../controls.ts';

let { attribute, inputId, disabled, commit }: AttributeControlProps = $props();
</script>

<Switch
	id={inputId}
	checked={attribute.value === true}
	label={attribute.value === true ? m.attributes_boolean_yes() : m.attributes_boolean_no()}
	{disabled}
	onCheckedChange={(checked) => commit(checked)}
/>
