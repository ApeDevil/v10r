/**
 * The bridge between web_core's signals (Preact signals inside `@a2ui/web_core`) and Svelte's
 * reactivity: reading `.current` inside a template or `$derived` subscribes to the signal, and
 * a change to it re-runs exactly the readers that depend on it. Outside a reactive context
 * (server rendering, a test) it simply returns the signal's current value.
 */
import { effect, getValue, peekValue, type Signal } from '@a2ui/web_core';
import { createSubscriber } from 'svelte/reactivity';

export interface SignalReader<T> {
	readonly current: T;
}

export function readSignal<T>(signal: Signal<T>): SignalReader<T> {
	const subscribe = createSubscriber((update) => {
		// web_core's `effect` runs once immediately to learn its dependencies; that first run is
		// not a change, so it must not invalidate the reader that is subscribing right now.
		let started = false;
		return effect(() => {
			getValue(signal);
			if (started) update();
			started = true;
		});
	});
	return {
		get current() {
			subscribe();
			return peekValue(signal);
		},
	};
}
