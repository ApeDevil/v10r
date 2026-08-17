<script lang="ts">
// Global stylesheet, UnoCSS utilities, and fonts live at the ROOT layout so they
// apply to every route — including full-screen pages that break out of the locale
// layout (`+page@.svelte`) to shed the app chrome (the 3D viewer + customizer).
// They must NOT move to the locale layout, which also provides the chrome: a
// chrome-shedding breakout would then render token-less and without UnoCSS
// utilities (no design tokens, no `fixed`/`inset-0`, broken dialogs).
import 'uno.css';
import '../app.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito';
import { visualViewportWatcher } from '$lib/state/visual-viewport.svelte';

let { children } = $props();

// One keyboard watcher per tab — publishes --keyboard-inset + data-keyboard
// on <html>; floating corner controls consume it via .fab-keyboard-hide.
$effect(() => visualViewportWatcher.attach());
</script>

{@render children()}
