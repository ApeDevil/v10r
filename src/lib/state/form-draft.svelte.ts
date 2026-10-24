/**
 * A Superforms form bound to a browser draft (`form-draft.ts`): every change while the form is
 * tainted is written after a short debounce, a stored draft that differs from the form is
 * OFFERED — never applied on its own — and a valid submit clears it.
 *
 * Call during component initialisation, after `superForm(...)`. Everything that touches storage
 * runs in `$effect`, so the server render and the first client render agree (no draft on
 * either), and the offer appears once the page is interactive. A write still waiting out its
 * debounce is flushed on `pagehide` and when the component goes, so closing the tab right
 * after typing loses nothing.
 *
 * ```ts
 * const sf = superForm(data.form, {
 *   validators: valibotClient(schema),
 *   onUpdated: ({ form }) => { if (form.valid) draft.clear(); },
 * });
 * const draft = createFormDraft(sf, { formId: 'profile', owner: data.user?.id ?? null });
 * ```
 */
import { untrack } from 'svelte';
import type { SuperFormData } from 'sveltekit-superforms/client';
import { browser } from '$app/env';
import { createFormDraftStore, draftDiffers, type FormDraft } from './form-draft';

/** The two parts of a `superForm()` result a draft needs. */
export interface DraftableForm<T extends Record<string, unknown>> {
	form: SuperFormData<T>;
	isTainted: () => boolean;
}

export interface FormDraftOptions<T> {
	formId: string;
	owner: string | null;
	version?: number;
	exclude?: readonly (keyof T & string)[];
	debounceMs?: number;
	storage?: () => Storage | null;
}

export interface FormDraftBinding {
	/** A stored draft that differs from the form, waiting for the person to decide. */
	readonly offer: { savedAt: number } | null;
	/** True when the last write was refused — the only case where leaving loses work. */
	readonly saveFailed: boolean;
	restore(): void;
	discard(): void;
	/** Forget the draft — call it once a submit succeeded. */
	clear(): void;
}

const DEFAULT_DEBOUNCE_MS = 500;

export function createFormDraft<T extends Record<string, unknown>>(
	sf: DraftableForm<T>,
	options: FormDraftOptions<T>,
): FormDraftBinding {
	let current = readCurrent(sf.form);
	const store = createFormDraftStore<T>({
		formId: options.formId,
		owner: options.owner,
		version: options.version,
		exclude: options.exclude,
		template: current,
		storage: options.storage ?? (() => (browser ? window.localStorage : null)),
	});

	let pendingDraft: FormDraft<T> | null = null;
	let offer = $state<{ savedAt: number } | null>(null);
	let saveFailed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** Write the form now: its data while tainted; otherwise forget the draft — unless one is on offer. */
	function persist(): void {
		clearTimeout(timer);
		timer = undefined;
		if (sf.isTainted()) saveFailed = !store.write(current);
		else if (!offer) store.clear();
	}

	function schedule(): void {
		clearTimeout(timer);
		timer = setTimeout(persist, options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
	}

	/** A write still waiting out its debounce lands now — on leaving the page or the component. */
	function flush(): void {
		if (timer !== undefined) persist();
	}

	$effect(() => {
		const stored = store.read();
		if (stored && draftDiffers(stored.data, current)) {
			pendingDraft = stored;
			offer = { savedAt: stored.savedAt };
		}

		// The store calls back synchronously once on subscribe; untracked, so the effect does not
		// re-run (and re-read storage) every time the offer changes. Typing while an offer is open
		// replaces the stored draft with the newer work — the offered one stays restorable from
		// memory until the person decides.
		const unsubscribe = sf.form.subscribe((data) =>
			untrack(() => {
				current = data;
				schedule();
			}),
		);
		window.addEventListener('pagehide', flush);
		return () => {
			flush();
			window.removeEventListener('pagehide', flush);
			unsubscribe();
		};
	});

	function closeOffer(): void {
		pendingDraft = null;
		offer = null;
	}

	return {
		get offer() {
			return offer;
		},
		get saveFailed() {
			return saveFailed;
		},
		restore() {
			const draft = pendingDraft;
			closeOffer();
			if (draft) sf.form.set({ ...current, ...draft.data }, { taint: true });
		},
		discard() {
			store.clear();
			closeOffer();
			// Work typed while the offer was open is still worth keeping.
			schedule();
		},
		clear() {
			clearTimeout(timer);
			timer = undefined;
			store.clear();
			closeOffer();
			saveFailed = false;
		},
	};
}

function readCurrent<T extends Record<string, unknown>>(form: SuperFormData<T>): T {
	let value!: T;
	form.subscribe((data) => {
		value = data;
	})();
	return value;
}
