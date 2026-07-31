<script lang="ts">
import { enhance } from '$app/forms';
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const messages = {
	invalid: {
		title: 'Pairing code not recognised',
		body: 'Check that you typed the code correctly, or ask the admin to generate a new one.',
	},
	expired: {
		title: 'Pairing link has expired',
		body: 'Codes are valid for 10 minutes. Ask the admin to generate a new one.',
	},
	consumed: {
		title: 'Pairing link was already used',
		body: 'Each code can only be used once. Ask the admin to generate a new one.',
	},
	attempts_exceeded: {
		title: 'Too many attempts on this code',
		body: 'For security, this code is now disabled. Ask the admin to generate a new one.',
	},
	rate_limited: {
		title: 'Too many attempts',
		body: 'Please wait a minute, then scan the code again.',
	},
} as const;

// Action failures win over load failures — the load only checks the shape.
const failure = $derived(form?.failure ?? ('failure' in data ? data.failure : null));
const msg = $derived(failure ? messages[failure] : null);
</script>

<svelte:head>
	<title>Pairing</title>
</svelte:head>

<main class="page">
	{#if msg}
		<section class="card">
			<span class="i-lucide-alert-circle icon" aria-hidden="true"></span>
			<h1 class="title">{msg.title}</h1>
			<p class="body">{msg.body}</p>
			<a href="/" class="link">Return to homepage</a>
		</section>
	{:else}
		<!-- Deliberate one-tap confirm: the claim consumes a single-use code, so it
		     must not run on the GET a QR scan / link preview triggers. -->
		<section class="card">
			<span class="i-lucide-smartphone icon" aria-hidden="true"></span>
			<h1 class="title">{m.pair_confirm_title()}</h1>
			<p class="body">{m.pair_confirm_body()}</p>
			<form method="POST" action="?/claim" use:enhance>
				<Button type="submit" variant="primary" size="md">{m.pair_confirm_cta()}</Button>
			</form>
		</section>
	{/if}
</main>

<style>
	.page {
		display: flex;
		min-height: 100dvh;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-6);
		background: var(--color-bg);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		max-width: 32rem;
		padding: var(--spacing-8) var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-2);
		text-align: center;
	}
	.icon {
		font-size: 2.5rem;
		color: var(--color-muted);
	}
	.title {
		margin: 0;
		font-size: var(--text-fluid-xl);
		font-weight: 600;
		color: var(--color-fg);
	}
	.body {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
	}
	.link {
		margin-top: var(--spacing-2);
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}
	.link:hover {
		text-decoration: underline;
	}
</style>
