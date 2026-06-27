<!--
  Engine selector: Hybrid tiers ⟷ LLM Wiki. One engine runs per turn (the other's lanes
  render as "not run" — see surfaces.md / Phase 4 deferred true single-run). Locked mid-turn.
-->
<script lang="ts">
import { ToggleGroup } from '$lib/components/primitives';

type Engine = 'hybrid' | 'llmwiki';

interface Props {
	engine: Engine;
	onchange: (engine: Engine) => void;
	disabled?: boolean;
}

let { engine, onchange, disabled = false }: Props = $props();

let current = $state<string>(engine);

const items = [
	{ value: 'hybrid', label: 'Hybrid tiers' },
	{ value: 'llmwiki', label: 'LLM Wiki' },
];

// `current` only ever changes from a user toggle; after onchange flips `engine` the values
// reconcile and this becomes a no-op (no reactive loop).
$effect(() => {
	if (current !== engine) {
		onchange(current === 'llmwiki' ? 'llmwiki' : 'hybrid');
	}
});
</script>

<ToggleGroup type="single" size="sm" {items} bind:value={current} {disabled} />
