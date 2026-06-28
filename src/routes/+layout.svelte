<script lang="ts">
// Global stylesheet, UnoCSS utilities, and fonts live at the ROOT layout so they
// apply to every route — including full-screen pages that break out of the locale
// layout (`+page@.svelte`) to shed the app chrome (the 3D viewer + customizer).
// These imports previously lived only in the locale layout, which also provides
// the chrome, so any chrome-shedding breakout rendered token-less and without
// UnoCSS utilities (no design tokens, no `fixed`/`inset-0`, broken dialogs).
import 'uno.css';
import '../app.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito';

let { children } = $props();
</script>

{@render children()}
