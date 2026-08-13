/**
 * CLIENT TELEMETRY — behaviour and performance signals.
 *
 * What this collects, and why each one earns its place:
 *
 * - **Web Vitals with attribution.** A bare INP number tells you something is
 *   slow; the attribution build tells you WHICH element, which interaction type,
 *   and which phase (input delay / processing / presentation). That difference
 *   is what makes the metric actionable instead of merely alarming, and it is
 *   the single highest-value signal here.
 * - **Engaged time**, measured with `visibilitychange` rather than wall clock.
 *   Time-on-page counted from load treats a forgotten background tab as deep
 *   reading, which is why raw time-on-page is a vanity metric.
 * - **Rage and dead clicks.** These are the derived signals session replay is
 *   normally used to hunt for — obtainable in aggregate, without recording
 *   anyone's screen.
 * - **Scroll depth**, bucketed to quartiles. A continuous value would be both
 *   higher cardinality and marginally more identifying, for no extra insight.
 * - **Uncaught errors**, message only.
 *
 * ## What it deliberately does NOT collect
 *
 * No session recording, no mouse tracks, no keystrokes, and no form field
 * CONTENT — only which field was last touched before a form was abandoned. That
 * boundary is not stylistic: field content can incidentally capture
 * special-category data, which changes the legal analysis entirely.
 *
 * Nothing here reads screen size, timezone, canvas, or fonts. The server's
 * visitor hash is built from IP + User-Agent alone, and its defensibility rests
 * on adding no further entropy — a client that quietly collected more would
 * undermine it from the other end.
 *
 * ## Consent
 *
 * Collection is gated at the source, re-checked on every flush, and the queue is
 * discarded on withdrawal — a visitor who revokes mid-session must not have
 * buffered events delivered afterwards.
 */

import { browser, dev } from '$app/environment';
import { beacon } from './transport';

const ENDPOINT = '/api/analytics/journey/collect';
const MAX_BATCH = 50;
/** Clicks on one target within this window to count as rage. */
const RAGE_WINDOW_MS = 1000;
const RAGE_THRESHOLD = 3;

interface QueuedEvent {
	eventId: string;
	kind: 'action' | 'timing' | 'error';
	name: string;
	path: string;
	route: string;
	value?: number;
	props?: Record<string, unknown>;
	occurredAt: string;
}

let initialized = false;
let queue: QueuedEvent[] = [];
let hasConsent = false;
/** Supplied by the app; lets the module read the current templated route. */
let routeOf: () => string = () => '(unknown)';

// ── Queue ────────────────────────────────────────────────────────────────────

function push(kind: QueuedEvent['kind'], name: string, extra: Partial<QueuedEvent> = {}): void {
	if (!hasConsent) return;
	queue.push({
		eventId: crypto.randomUUID(),
		kind,
		name,
		path: location.pathname,
		route: routeOf(),
		occurredAt: new Date().toISOString(),
		...extra,
	});
	if (queue.length >= MAX_BATCH) flush();
}

function flush(): void {
	// Re-checked here, not only at push time: consent can be withdrawn while
	// events sit in the queue, and those must never be delivered.
	if (!hasConsent) {
		queue = [];
		return;
	}
	if (queue.length === 0) return;
	beacon(ENDPOINT, { events: queue.splice(0, MAX_BATCH) });
}

/** Called by the app whenever the consent tier changes. */
export function setTelemetryConsent(granted: boolean): void {
	if (!granted && hasConsent) queue = []; // withdrawal drops anything buffered
	hasConsent = granted;
}

// ── Web Vitals ───────────────────────────────────────────────────────────────

async function initVitals(): Promise<void> {
	// Dynamically imported so the attribution build — which is the larger one —
	// never lands on the critical path for the initial render.
	const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals/attribution');

	const send = (name: string, value: number, target?: string) => {
		push('timing', name, { value, props: target ? { target: target.slice(0, 120) } : undefined });
	};

	// Each metric names its culprit differently, and each callback is typed to its
	// own attribution shape — hence one arrow per metric rather than a shared
	// handler. The target is the whole point: it turns "INP is 400ms" into "this
	// button takes 400ms", which is the difference between a number and a lead.
	onLCP((m) => send(m.name, m.value, m.attribution.target));
	onINP((m) => send(m.name, m.value, m.attribution.interactionTarget));
	onCLS((m) => send(m.name, m.value, m.attribution.largestShiftTarget));
	onTTFB((m) => send(m.name, m.value));
	onFCP((m) => send(m.name, m.value));
}

// ── Engagement ───────────────────────────────────────────────────────────────

let engagedMs = 0;
let lastResume = 0;
let maxScrollPct = 0;
const scrollBucketsSeen = new Set<string>();

function resumeEngagement(): void {
	lastResume = performance.now();
}

function pauseEngagement(): void {
	if (lastResume === 0) return;
	engagedMs += performance.now() - lastResume;
	lastResume = 0;
}

/** Emit accumulated engagement and reset. Called on hide and on navigation. */
function reportEngagement(): void {
	pauseEngagement();
	const seconds = Math.round(engagedMs / 1000);
	// Sub-second visits are almost always a bounce or a misclick; recording them
	// adds rows without adding information.
	if (seconds >= 1) {
		push('action', 'engagement', { props: { seconds, maxScroll: Math.round(maxScrollPct) } });
	}
	engagedMs = 0;
	maxScrollPct = 0;
	scrollBucketsSeen.clear();
	if (document.visibilityState === 'visible') resumeEngagement();
}

// ── Scroll depth ─────────────────────────────────────────────────────────────

function onScroll(): void {
	const doc = document.documentElement;
	const scrollable = doc.scrollHeight - window.innerHeight;
	if (scrollable <= 0) return;

	const pct = Math.min(100, ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100);
	if (pct > maxScrollPct) maxScrollPct = pct;

	for (const bucket of ['25', '50', '75', '100']) {
		if (pct >= Number(bucket) && !scrollBucketsSeen.has(bucket)) {
			scrollBucketsSeen.add(bucket);
			push('action', 'scroll_depth', { props: { bucket } });
		}
	}
}

// ── Rage + dead clicks ───────────────────────────────────────────────────────

/**
 * A short, stable description of an element — tag, id, and up to two classes.
 * Never text content, never a value, never an index path: enough to find the
 * element in the source, not enough to reconstruct the page or the visitor.
 */
function describe(el: Element): string {
	const tag = el.tagName.toLowerCase();
	const id = el.id ? `#${el.id}` : '';
	const cls =
		typeof el.className === 'string'
			? el.className
					.split(/\s+/)
					.filter(Boolean)
					.slice(0, 2)
					.map((c) => `.${c}`)
					.join('')
			: '';
	return `${tag}${id}${cls}`.slice(0, 120);
}

let lastTarget = '';
let lastClickAt = 0;
let repeatCount = 0;

function onClick(evt: MouseEvent): void {
	const el = evt.target instanceof Element ? evt.target : null;
	if (!el) return;

	const target = describe(el);
	const now = performance.now();

	if (target === lastTarget && now - lastClickAt < RAGE_WINDOW_MS) {
		repeatCount += 1;
		if (repeatCount === RAGE_THRESHOLD) {
			push('action', 'rage_click', { props: { target, count: repeatCount } });
		}
	} else {
		repeatCount = 1;
	}
	lastTarget = target;
	lastClickAt = now;

	// Dead click: nothing interactive was hit and nothing changed. Checked on the
	// next frame so a handler that mutates the DOM has had its chance to run.
	const interactive = el.closest('a, button, input, select, textarea, label, summary, [role], [onclick], [tabindex]');
	if (interactive) return;

	const domBefore = document.body.childElementCount;
	const urlBefore = location.href;
	requestAnimationFrame(() => {
		if (document.body.childElementCount === domBefore && location.href === urlBefore) {
			push('action', 'dead_click', { props: { target } });
		}
	});
}

// ── Form abandonment ─────────────────────────────────────────────────────────

let touchedForm: { form: string; lastField: string } | null = null;

function onFocusIn(evt: FocusEvent): void {
	const el = evt.target;
	if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
	// Field NAME only. What was typed into it is never read — that is the line
	// between behavioural data and potentially special-category data.
	touchedForm = {
		form: el.form?.getAttribute('name') ?? el.form?.id ?? 'unnamed',
		lastField: el.name || el.id || el.type,
	};
}

function onSubmit(): void {
	touchedForm = null; // submitted, so not abandoned
}

function reportFormAbandon(): void {
	if (!touchedForm) return;
	push('action', 'form_abandon', { props: touchedForm });
	touchedForm = null;
}

// ── Errors ───────────────────────────────────────────────────────────────────

function onError(evt: ErrorEvent): void {
	push('error', 'uncaught', { props: { message: evt.message } });
}

function onRejection(evt: PromiseRejectionEvent): void {
	const reason = evt.reason;
	const message = reason instanceof Error ? reason.message : String(reason);
	push('error', 'unhandled_rejection', { props: { message } });
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initTelemetry(getRoute: () => string): void {
	// `dev` is a hard gate, not a preference. The dev server points at the ONE
	// production database, so without this every local page load posted Web Vitals
	// into `analytics.events` alongside real users. Measured 2026-08-12: 36 of 53
	// LCP samples and 29 of 63 CLS samples over 30 days were dev-server rows,
	// identifiable because Vite dev emits `s-XXXXXXXXXXXX` Svelte scope classes
	// while the prod build emits `svelte-XXXXXX`. They carried LCP values up to
	// 1,798,024 ms (a backgrounded dev tab finalizing LCP on refocus), which
	// dragged the p75 and made the vitals board actively misleading.
	if (!browser || dev || initialized) return;
	initialized = true;
	routeOf = getRoute;

	void initVitals();

	resumeEngagement();
	addEventListener('scroll', onScroll, { passive: true });
	addEventListener('click', onClick, { passive: true, capture: true });
	addEventListener('focusin', onFocusIn, { passive: true, capture: true });
	addEventListener('submit', onSubmit, { capture: true });
	addEventListener('error', onError);
	addEventListener('unhandledrejection', onRejection);

	// bfcache restore: the page becomes active again without a fresh load, so
	// engagement has to restart rather than continue from the original load.
	addEventListener('pageshow', (evt) => {
		if (evt.persisted) {
			engagedMs = 0;
			resumeEngagement();
		}
	});

	addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			reportEngagement();
			reportFormAbandon();
			flush();
		} else {
			resumeEngagement();
		}
	});

	addEventListener('pagehide', () => {
		reportEngagement();
		reportFormAbandon();
		flush();
	});
}

/** Called on SPA navigation: the previous page's engagement is now final. */
export function telemetryOnNavigate(): void {
	reportEngagement();
	reportFormAbandon();
}
