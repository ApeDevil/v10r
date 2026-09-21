<script lang="ts">
/**
 * On-device keyboard diagnostics. Dev-only: `(dev)` routes 404 in production
 * (devRouteGuard in hooks.server.ts). Lives outside [[locale=locale]] so only the
 * ROOT layout applies — global CSS, the variable fonts, the visual-viewport
 * watcher — and nothing from the app shell can be blamed for what shows here.
 *
 * A phone has no DevTools. This page prints, on screen, everything the
 * soft-keyboard path emits — pointer, focus, key, composition, input and
 * viewport events, plus whether any handler called preventDefault — next to
 * four fields that differ in exactly one respect each:
 *   A  native <input>, no Svelte binding
 *   B  native <input> with bind:value
 *   C  the Input primitive with bind:value
 *   D  native <textarea>
 * The raw inputs are deliberate: the component-first rule exists for product UI,
 * and the raw-vs-primitive comparison IS the diagnostic.
 *
 * Query toggles isolate root-layout suspects without a rebuild:
 *   ?nowatch        detach the visual-viewport watcher
 *   ?nocover        drop viewport-fit=cover from the viewport meta
 *   ?systemfont     render with system-ui instead of the variable fonts
 *   ?nocss[=part]   disable every stylesheet, or only those whose dev id / href
 *                   contains `part` (e.g. app.css, uno.css, fontsource)
 *
 * Two channels survive a hang: the tab title carries the heartbeat (the browser
 * process paints it, so it keeps ticking through a renderer paint stall and
 * stops only when JS itself is stuck), and every log line is POSTed to
 * ./log/+server.ts, which prints it to the dev server's stdout.
 */
import { onMount } from 'svelte';
import { Button, Input } from '$lib/components/primitives';
import { visualViewportWatcher } from '$lib/state/visual-viewport.svelte';

const MAX_LINES = 80;

let valueB = $state('');
let valueC = $state('');
let lines = $state<string[]>([]);
let toggles = $state({ nowatch: false, nocover: false, systemfont: false, nocss: null as string | null });
let snapshot = $state({
	innerHeight: 0,
	vvHeight: 0,
	vvOffsetTop: 0,
	vvScale: 1,
	keyboard: '-',
	inset: '-',
	active: '-',
	hasFocus: false,
	visibility: '-',
	beat: 0,
	ua: '',
});

const t0 = typeof performance === 'undefined' ? 0 : performance.now();

/** Fire-and-forget copy of a line to the dev server's stdout (see ./log/+server.ts). */
function ship(line: string) {
	fetch('/keyboard-diagnostics/log', {
		method: 'POST',
		keepalive: true,
		headers: { 'content-type': 'text/plain', 'x-requested-with': 'fetch' },
		body: line,
	}).catch(() => {});
}

function log(line: string) {
	const stamp = ((performance.now() - t0) / 1000).toFixed(2).padStart(6);
	const stamped = `${stamp}s ${line}`;
	lines = [stamped, ...lines].slice(0, MAX_LINES);
	ship(stamped);
}

function describe(target: EventTarget | null): string {
	if (target === document) return 'document';
	if (target === window) return 'window';
	if (!(target instanceof Element)) return String(target);
	return `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}`;
}

let beat = 0;

function measure() {
	const vv = window.visualViewport;
	const root = document.documentElement;
	beat += 1;
	snapshot = {
		innerHeight: window.innerHeight,
		vvHeight: vv ? Math.round(vv.height) : 0,
		vvOffsetTop: vv ? Math.round(vv.offsetTop) : 0,
		vvScale: vv ? Number(vv.scale.toFixed(2)) : 1,
		keyboard: root.dataset.keyboard ?? '-',
		inset: root.style.getPropertyValue('--keyboard-inset') || '-',
		active: describe(document.activeElement),
		hasFocus: document.hasFocus(),
		visibility: document.visibilityState,
		beat,
		ua: navigator.userAgent,
	};
	document.title = `hb ${beat} · vv ${snapshot.vvHeight} · ${snapshot.active}`;
	// Every 2 s the sink also gets a heartbeat, so a hang is visible as silence.
	if (beat % 4 === 0)
		ship(`heartbeat hb=${beat} vv=${snapshot.vvHeight} inner=${snapshot.innerHeight} active=${snapshot.active}`);
}

onMount(() => {
	const params = new URLSearchParams(location.search);
	toggles = {
		nowatch: params.has('nowatch'),
		nocover: params.has('nocover'),
		systemfont: params.has('systemfont'),
		nocss: params.has('nocss') ? params.get('nocss') : null,
	};

	if (toggles.nocss !== null) {
		const part = toggles.nocss;
		let disabled = 0;
		for (const sheet of document.styleSheets) {
			const node = sheet.ownerNode as HTMLElement | null;
			const id = node?.dataset.viteDevId ?? (node as HTMLLinkElement | null)?.href ?? '';
			if (part === '' || id.includes(part)) {
				sheet.disabled = true;
				disabled += 1;
			}
		}
		log(`toggle: ${disabled}/${document.styleSheets.length} stylesheets disabled (${part || 'all'})`);
	}

	if (toggles.nowatch) {
		// attach() is idempotent and hands back the live detach function.
		visualViewportWatcher.attach()();
		log('toggle: visual-viewport watcher detached');
	}
	if (toggles.nocover) {
		const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
		if (meta) {
			meta.content = 'width=device-width, initial-scale=1';
			log(`toggle: viewport meta → ${meta.content}`);
		}
	}
	if (toggles.systemfont) {
		document.body.style.fontFamily = 'system-ui, sans-serif';
		log('toggle: body font → system-ui');
	}

	// Registered on `window` in the bubble phase, after the layouts' own
	// listeners, so `defaultPrevented` reflects what THEY did to the event.
	const flag = (e: Event) => (e.defaultPrevented ? ' PREVENTED' : '');
	const onViewport = (e: Event) => {
		measure();
		log(
			`vv.${e.type} h=${snapshot.vvHeight} top=${snapshot.vvOffsetTop} inner=${snapshot.innerHeight} kb=${snapshot.keyboard}`,
		);
	};
	const onResize = () => {
		measure();
		log(`window.resize inner=${snapshot.innerHeight}`);
	};
	const onFocus = (e: FocusEvent) => {
		measure();
		log(`${e.type} ${describe(e.target)}`);
	};
	const onKey = (e: KeyboardEvent) =>
		log(`${e.type} key=${e.key} code=${e.code} kc=${e.keyCode} composing=${e.isComposing}${flag(e)}`);
	const onBeforeInput = (e: Event) => {
		const ie = e as InputEvent;
		log(`beforeinput ${ie.inputType} data=${JSON.stringify(ie.data)}${flag(e)}`);
	};
	const onInput = (e: Event) => {
		const el = e.target as HTMLInputElement | HTMLTextAreaElement;
		log(`input ${describe(el)} len=${el.value.length} composing=${(e as InputEvent).isComposing}`);
	};
	const onComposition = (e: CompositionEvent) => log(`${e.type} data=${JSON.stringify(e.data)}`);
	const onPointer = (e: PointerEvent) => log(`pointerdown ${e.pointerType} → ${describe(e.target)}${flag(e)}`);
	const onError = (e: ErrorEvent) => log(`ERROR ${e.message}`);
	const onRejection = (e: PromiseRejectionEvent) => log(`REJECTION ${String(e.reason)}`);
	// Window-level focus (element focus/blur do not bubble, so these are the
	// window's own). An IME that never appears while the window is blurred means
	// something above Chrome holds Android's input focus.
	const onWindowFocus = (e: Event) => {
		measure();
		log(`window.${e.type} hasFocus=${document.hasFocus()}`);
	};
	const onTouch = (e: TouchEvent) => log(`${e.type} n=${e.touches.length} cancelable=${e.cancelable}${flag(e)}`);
	const onClick = (e: MouseEvent) => log(`click → ${describe(e.target)}${flag(e)}`);

	const vv = window.visualViewport;
	vv?.addEventListener('resize', onViewport);
	vv?.addEventListener('scroll', onViewport);
	window.addEventListener('resize', onResize);
	window.addEventListener('focusin', onFocus);
	window.addEventListener('focusout', onFocus);
	window.addEventListener('keydown', onKey);
	window.addEventListener('keyup', onKey);
	window.addEventListener('beforeinput', onBeforeInput);
	window.addEventListener('input', onInput);
	window.addEventListener('compositionstart', onComposition);
	window.addEventListener('compositionupdate', onComposition);
	window.addEventListener('compositionend', onComposition);
	window.addEventListener('pointerdown', onPointer);
	window.addEventListener('error', onError);
	window.addEventListener('unhandledrejection', onRejection);
	window.addEventListener('focus', onWindowFocus);
	window.addEventListener('blur', onWindowFocus);
	window.addEventListener('touchstart', onTouch, { passive: true });
	window.addEventListener('touchend', onTouch, { passive: true });
	window.addEventListener('touchcancel', onTouch, { passive: true });
	window.addEventListener('click', onClick);
	// The heartbeat proves the main thread is alive even when nothing renders:
	// `hb` in the status bar keeps counting while the page is alive.
	const heartbeat = setInterval(measure, 500);

	measure();
	log(`ready — toggles ${JSON.stringify(toggles)}`);

	return () => {
		vv?.removeEventListener('resize', onViewport);
		vv?.removeEventListener('scroll', onViewport);
		window.removeEventListener('resize', onResize);
		window.removeEventListener('focusin', onFocus);
		window.removeEventListener('focusout', onFocus);
		window.removeEventListener('keydown', onKey);
		window.removeEventListener('keyup', onKey);
		window.removeEventListener('beforeinput', onBeforeInput);
		window.removeEventListener('input', onInput);
		window.removeEventListener('compositionstart', onComposition);
		window.removeEventListener('compositionupdate', onComposition);
		window.removeEventListener('compositionend', onComposition);
		window.removeEventListener('pointerdown', onPointer);
		window.removeEventListener('error', onError);
		window.removeEventListener('unhandledrejection', onRejection);
		window.removeEventListener('focus', onWindowFocus);
		window.removeEventListener('blur', onWindowFocus);
		window.removeEventListener('touchstart', onTouch);
		window.removeEventListener('touchend', onTouch);
		window.removeEventListener('touchcancel', onTouch);
		window.removeEventListener('click', onClick);
		clearInterval(heartbeat);
	};
});
</script>

<svelte:head>
	<title>Keyboard diagnostics · v10r</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="lab">
	<!-- Sticky so it stays readable while the keyboard covers the lower half. -->
	<div class="status" aria-live="polite">
		<div class="status-row">
			<span>inner {snapshot.innerHeight}</span>
			<span>vv {snapshot.vvHeight}/{snapshot.vvOffsetTop} ×{snapshot.vvScale}</span>
			<span>kb {snapshot.keyboard} {snapshot.inset}</span>
			<span>active {snapshot.active}</span>
			<span>win {snapshot.hasFocus ? 'focused' : 'BLURRED'}</span>
			<span>vis {snapshot.visibility}</span>
			<span>hb {snapshot.beat}</span>
		</div>
		<pre class="status-tail">{lines.slice(0, 3).join('\n')}</pre>
	</div>

	<h1 class="title">Keyboard diagnostics</h1>
	<p class="hint">Tap a field, type a few characters, then read the log. Toggles: <code>?nowatch</code> <code>?nocover</code> <code>?systemfont</code> <code>?nocss</code></p>

	<div class="field">
		<label for="kd-a">A · native input, no binding</label>
		<input id="kd-a" class="raw" type="text" autocomplete="off" placeholder="type here" />
	</div>

	<div class="field">
		<label for="kd-b">B · native input, bind:value → “{valueB}”</label>
		<input id="kd-b" class="raw" type="text" autocomplete="off" placeholder="type here" bind:value={valueB} />
	</div>

	<div class="field">
		<label for="kd-c">C · Input primitive, bind:value → “{valueC}”</label>
		<Input id="kd-c" type="text" autocomplete="off" placeholder="type here" bind:value={valueC} />
	</div>

	<div class="field">
		<label for="kd-d">D · native textarea</label>
		<textarea id="kd-d" class="raw" rows="2" autocomplete="off" placeholder="type here"></textarea>
	</div>

	<div class="actions">
		<Button size="sm" variant="outline" onclick={() => (lines = [])}>Clear log</Button>
		<Button size="sm" variant="outline" onclick={() => location.reload()}>Reload</Button>
	</div>

	<pre class="log">{lines.join('\n')}</pre>
	<p class="ua">{snapshot.ua}</p>
</main>

<style>
	.lab {
		min-height: 100dvh;
		padding: var(--spacing-4);
		padding-bottom: max(var(--spacing-6), env(safe-area-inset-bottom, 0px));
		background: var(--color-bg);
		color: var(--color-fg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}
	.status {
		position: sticky;
		top: 0;
		z-index: 1;
		margin: calc(-1 * var(--spacing-4)) calc(-1 * var(--spacing-4)) 0;
		padding: var(--spacing-2) var(--spacing-4);
		background: var(--surface-3);
		border-bottom: 1px solid var(--color-border);
		font-family: var(--font-mono, monospace);
		font-size: var(--text-fluid-xs);
	}
	.status-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2) var(--spacing-4);
	}
	.status-tail {
		margin: var(--spacing-1) 0 0;
		white-space: pre-wrap;
		color: var(--color-muted);
	}
	.title {
		margin: 0;
		font-size: var(--text-fluid-lg);
	}
	.hint {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
	.field label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}
	.raw {
		height: 2.75rem;
		padding: 0 var(--spacing-4);
		font: inherit;
		color: var(--color-fg);
		background: var(--color-input);
		border: 1px solid var(--color-input-border);
		border-radius: var(--radius-md);
	}
	textarea.raw {
		height: auto;
		padding: var(--spacing-2) var(--spacing-4);
	}
	.actions {
		display: flex;
		gap: var(--spacing-2);
	}
	.log {
		margin: 0;
		padding: var(--spacing-3);
		min-height: 12rem;
		max-height: 60dvh;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-all;
		font-family: var(--font-mono, monospace);
		font-size: var(--text-fluid-xs);
		background: var(--surface-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.ua {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}
</style>
