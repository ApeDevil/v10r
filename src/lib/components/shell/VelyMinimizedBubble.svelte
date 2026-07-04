<script lang="ts">
/**
 * Floating restore affordance for a minimized Vely conversation on mobile, where the
 * sidebar (and its "Ask Vely" trigger) is offscreen in a closed drawer. Mounted in the
 * ROOT layout reading the chatbot-session singleton directly — it pulls NO AI SDK, so
 * it is cheap to have present everywhere. Hidden at md+ (desktop restores via the
 * sidebar trigger). Stacks above the 56px mobile menu FAB.
 */
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
import { cn } from '$lib/utils/cn';
</script>

{#if chatbotSession.phase === 'minimized'}
	<button
		type="button"
		class="vely-bubble fixed right-4 z-fab h-[48px] w-[48px] rounded-full border border-border bg-surface-3 text-fg shadow-lg"
		aria-label={chatbotSession.answerReady ? 'Resume Vely — new reply' : 'Resume Vely conversation'}
		onclick={() => chatbotSession.restore()}
	>
		<span class="i-lucide-bot text-icon-lg"></span>
		<span class={cn('vely-bubble-dot', chatbotSession.answerReady && 'vely-bubble-dot-ready')} aria-hidden="true">
			{#if chatbotSession.answerReady}<span class="vely-bubble-ping"></span>{/if}
		</span>
	</button>
{/if}

<style>
	.vely-bubble {
		/* display owned here (not a utility) so the md+ hide can't lose a specificity race */
		display: flex;
		align-items: center;
		justify-content: center;
		/* clear the 56px menu FAB (bottom:12 + 56 + 8px gap) + iOS home indicator */
		bottom: calc(var(--safe-bottom) + 76px);
	}

	@media (min-width: 768px) {
		.vely-bubble {
			display: none;
		}
	}

	.vely-bubble-dot {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 10px;
		height: 10px;
		border-radius: 9999px;
		background-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-bg);
	}

	.vely-bubble-dot-ready {
		width: 12px;
		height: 12px;
	}

	.vely-bubble-ping {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		background-color: var(--color-primary);
		animation: vely-bubble-ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
	}

	@keyframes vely-bubble-ping {
		75%,
		100% {
			transform: scale(2.2);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.vely-bubble-ping {
			animation: none;
		}
	}
</style>
