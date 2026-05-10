<script lang="ts">
import { onMount } from 'svelte';

interface Props {
	/** Endpoint that issues ALTCHA challenges. */
	challengeUrl?: string;
	/** Form-field name carrying the solved payload (only relevant when nested in a form). */
	name?: string;
	/** Hide the small ALTCHA branding strip. */
	hideFooter?: boolean;
	/** Hide the ALTCHA logo inside the widget. */
	hideLogo?: boolean;
	class?: string;
	/** Fired with the solved payload string. Token is single-use — re-mount the
	 *  component (e.g. with `{#key}`) after the parent consumes it. */
	onverified?: (payload: string) => void;
	/** Fired when an in-flight challenge expires before the user submitted. */
	onexpired?: () => void;
}

let {
	challengeUrl = '/api/captcha/challenge',
	name = 'altcha',
	hideFooter = true,
	hideLogo = true,
	class: className,
	onverified,
	onexpired,
}: Props = $props();

let widget = $state<(HTMLElement & { configure?: (cfg: object) => void }) | undefined>();

onMount(async () => {
	// Custom-element registration is side-effecting; client-only import avoids
	// SSR / customElements-not-defined errors.
	await import('altcha');
	widget?.configure?.({ hideFooter, hideLogo });
});

$effect(() => {
	const el = widget;
	if (!el) return;

	const onVerified = (e: Event) => {
		const detail = (e as CustomEvent<{ payload: string }>).detail;
		if (detail?.payload) onverified?.(detail.payload);
	};
	const onState = (e: Event) => {
		const state = (e as CustomEvent<{ state: string }>).detail?.state;
		if (state === 'expired') onexpired?.();
	};

	el.addEventListener('verified', onVerified);
	el.addEventListener('statechange', onState);
	return () => {
		el.removeEventListener('verified', onVerified);
		el.removeEventListener('statechange', onState);
	};
});
</script>

<altcha-widget bind:this={widget} challenge={challengeUrl} {name} class={className}></altcha-widget>
