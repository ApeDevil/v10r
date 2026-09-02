<script lang="ts">
/**
 * Session expiry modal
 * Shows when session has expired — user must sign in again.
 * Sessions auto-renew, so this only appears after 7 days of inactivity.
 */

import { Button } from '$lib/components/primitives/button';
import { Dialog } from '$lib/components/primitives/dialog';
import { getModals } from '$lib/state';

type Props = {
	email: string;
	onSignIn: () => void;
	onSwitchUser: () => void;
};

let { email, onSignIn, onSwitchUser }: Props = $props();

const modals = getModals();
let open = $derived(modals.isOpen('sessionExpiry'));
</script>

<Dialog {open} title="Session Expired" class="max-w-md">
	<div class="flex flex-col gap-6">
		<div class="flex flex-col items-center gap-3 border-b border-border pb-4">
			<span class="i-lucide-lock text-5xl leading-none text-muted" aria-hidden="true"></span>
		</div>

		<p class="m-0 text-muted leading-relaxed">
			Your session has expired. Please sign in again to continue.
		</p>

		<div class="flex items-center gap-4 p-4 bg-subtle rounded-lg">
			<div class="avatar-circle" aria-hidden="true">
				{email.charAt(0).toUpperCase()}
			</div>
			<div class="font-medium text-fg">{email}</div>
		</div>

		<div class="flex flex-col gap-3">
			<Button variant="primary" onclick={onSignIn}>
				Log In Again
			</Button>

			<Button variant="secondary" onclick={onSwitchUser}>
				Log In as Different User
			</Button>
		</div>
	</div>
</Dialog>

<style>
	.avatar-circle {
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: 600;
	}
</style>
