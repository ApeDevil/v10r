<script lang="ts">
import { Dialog } from 'bits-ui';
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { layerStack } from '$lib/state/layer-stack.svelte';
import { useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';

interface Props {
	open: boolean;
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	onconfirm: () => void;
	oncancel: () => void;
}

let {
	open = $bindable(),
	title,
	description,
	confirmLabel = m.composites_confirm_dialog_confirm(),
	cancelLabel = m.composites_confirm_dialog_cancel(),
	destructive = false,
	onconfirm,
	oncancel,
}: Props = $props();

// Relative elevation — one rung above the surface this dialog was opened from (its scrim
// carries the separation).
const s = useSurface();

// Bits Dialog handles its own Escape/overlay dismissal; registration is for
// hand-rolled layers underneath (the mobile drawer) to know they're not top.
$effect(() => {
	if (open) {
		layerStack.push('confirm-dialog');
		return () => layerStack.pop('confirm-dialog');
	}
});
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-overlay bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<Dialog.Content
			{...s.attrs}
			class={cn(
				'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
				'w-[calc(100vw-2rem)] max-w-md rounded-lg border p-6',
				'max-h-[calc(100dvh-2rem)] overflow-y-auto',
				'flex flex-col gap-2',
				'data-[state=open]:animate-in data-[state=closed]:animate-out'
			)}
		>
			<Dialog.Title class="text-fluid-lg font-semibold text-fg">
				{title}
			</Dialog.Title>

			{#if description}
				<Dialog.Description class="text-fluid-sm text-muted">
					{description}
				</Dialog.Description>
			{/if}

			<div class="pt-4 flex justify-end gap-3">
				<Button variant="outline" onclick={oncancel}>
					{cancelLabel}
				</Button>
				<Button variant={destructive ? 'destructive' : 'default'} onclick={onconfirm}>
					{confirmLabel}
				</Button>
			</div>

			<Dialog.Close
				class="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
			>
				<span class="i-lucide-x h-4 w-4" ></span>
				<span class="sr-only">{m.composites_dialog_close()}</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
