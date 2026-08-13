<script lang="ts">
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { TracePlayer } from './surface-flow.state.svelte';

let { player }: { player: TracePlayer } = $props();

// The step rail is a documented Component-First exception: a roving-tabindex
// composite (discrete ticks, one tab stop) that no project component models.
let railEl: HTMLDivElement | undefined = $state();
let focusTick = $state(0);

const tickCount = $derived(player.length + 1);

function onRailKeydown(event: KeyboardEvent) {
	let next = focusTick;
	if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(focusTick + 1, tickCount - 1);
	else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(focusTick - 1, 0);
	else if (event.key === 'Home') next = 0;
	else if (event.key === 'End') next = tickCount - 1;
	else return;
	event.preventDefault();
	focusTick = next;
	player.seek(next);
	const tick = railEl?.querySelectorAll<HTMLButtonElement>('.tick')[next];
	tick?.focus();
}

// Announce position only on user-initiated changes — never during auto-play.
let announcement = $state('');
function announce() {
	announcement = m.showcase_ai_ctrl_step_of({ current: String(player.cursor), total: String(player.length) });
}
</script>

<div class="controls">
	<div class="buttons">
		{#if player.playing}
			<Button variant="secondary" size="icon" aria-label={m.showcase_ai_ctrl_pause()} onclick={() => player.pause()}>
				<span class="i-lucide-pause h-5 w-5" aria-hidden="true"></span>
			</Button>
		{:else}
			<Button variant="secondary" size="icon" aria-label={m.showcase_ai_ctrl_play()} onclick={() => player.play()}>
				<span class="i-lucide-play h-5 w-5" aria-hidden="true"></span>
			</Button>
		{/if}
		<Button
			variant="ghost"
			size="icon"
			aria-label={m.showcase_ai_ctrl_back()}
			onclick={() => {
				player.stepBack();
				announce();
			}}
		>
			<span class="i-lucide-skip-back h-5 w-5" aria-hidden="true"></span>
		</Button>
		<Button
			variant="ghost"
			size="icon"
			aria-label={m.showcase_ai_ctrl_forward()}
			onclick={() => {
				player.stepForward();
				announce();
			}}
		>
			<span class="i-lucide-skip-forward h-5 w-5" aria-hidden="true"></span>
		</Button>
		<Button
			variant="ghost"
			size="icon"
			aria-label={m.showcase_ai_ctrl_restart()}
			onclick={() => {
				player.restart();
				announce();
			}}
		>
			<span class="i-lucide-rotate-ccw h-5 w-5" aria-hidden="true"></span>
		</Button>
		<span class="counter" aria-hidden="true">{player.cursor} / {player.length}</span>
	</div>

	<div
		class="rail"
		role="group"
		aria-label={m.showcase_ai_ctrl_rail_aria()}
		bind:this={railEl}
		onkeydown={onRailKeydown}
	>
		{#each { length: tickCount } as _, i (i)}
			<button
				type="button"
				class="tick"
				class:reached={i <= player.cursor}
				class:halt={player.haltCursor !== -1 && i === player.haltCursor}
				tabindex={i === focusTick ? 0 : -1}
				aria-label={m.showcase_ai_ctrl_step_of({ current: String(i), total: String(player.length) })}
				aria-current={i === player.cursor ? 'step' : undefined}
				onclick={() => {
					focusTick = i;
					player.seek(i);
					announce();
				}}
			></button>
		{/each}
	</div>

	<span class="visually-hidden" role="status">{announcement}</span>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-3);
	}

	.buttons {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.counter {
		font-size: var(--text-fluid-xs);
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
		min-width: 4ch;
		margin-left: var(--spacing-1);
	}

	.rail {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	/* Discrete ticks, not a range slider — frames are discrete events. ≥24px targets. */
	.tick {
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		position: relative;
	}

	.tick::after {
		content: '';
		position: absolute;
		inset: 50%;
		width: 0.5rem;
		height: 0.5rem;
		transform: translate(-50%, -50%);
		border-radius: 9999px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.tick.reached::after {
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.tick.halt::after {
		border-radius: 2px;
		transform: translate(-50%, -50%) rotate(45deg);
		border-color: var(--color-warning);
	}

	.tick:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.tick[aria-current='step']::after {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 360px) {
		.rail {
			display: none;
		}
	}
</style>
