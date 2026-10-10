import { describe, expect, it, vi } from 'vitest';
import { createAnimationFrameCoalescer } from './animation-frame-coalescer';

/** A hand-cranked frame clock: `tick()` runs whatever is scheduled for the next frame. */
function frameClock() {
	let next = 1;
	const pending = new Map<number, () => void>();
	return {
		schedule: (callback: () => void) => {
			const handle = next++;
			pending.set(handle, callback);
			return handle;
		},
		unschedule: (handle: number) => {
			pending.delete(handle);
		},
		tick() {
			const callbacks = [...pending.values()];
			pending.clear();
			for (const callback of callbacks) callback();
		},
		get scheduled() {
			return pending.size;
		},
	};
}

describe('createAnimationFrameCoalescer', () => {
	it('applies only the latest value pushed before a frame', () => {
		const clock = frameClock();
		const apply = vi.fn();
		const coalescer = createAnimationFrameCoalescer<string>(apply, clock.schedule, clock.unschedule);

		coalescer.push('a');
		coalescer.push('ab');
		coalescer.push('abc');
		expect(apply).not.toHaveBeenCalled();
		expect(clock.scheduled).toBe(1);

		clock.tick();
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenLastCalledWith('abc');
	});

	it('schedules a fresh frame after the previous one ran', () => {
		const clock = frameClock();
		const apply = vi.fn();
		const coalescer = createAnimationFrameCoalescer<number>(apply, clock.schedule, clock.unschedule);

		coalescer.push(1);
		clock.tick();
		coalescer.push(2);
		clock.tick();
		expect(apply.mock.calls).toEqual([[1], [2]]);
	});

	it('does nothing on a frame with nothing queued', () => {
		const clock = frameClock();
		const apply = vi.fn();
		createAnimationFrameCoalescer<number>(apply, clock.schedule, clock.unschedule);
		clock.tick();
		expect(apply).not.toHaveBeenCalled();
	});

	it('flush applies immediately and drops the queued value', () => {
		const clock = frameClock();
		const apply = vi.fn();
		const coalescer = createAnimationFrameCoalescer<string>(apply, clock.schedule, clock.unschedule);

		coalescer.push('partial');
		coalescer.flush('final');
		expect(apply.mock.calls).toEqual([['final']]);
		expect(clock.scheduled).toBe(0);

		clock.tick();
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it('settle applies the queued value now, once', () => {
		const clock = frameClock();
		const apply = vi.fn();
		const coalescer = createAnimationFrameCoalescer<number>(apply, clock.schedule, clock.unschedule);

		coalescer.push(42);
		coalescer.settle();
		expect(apply.mock.calls).toEqual([[42]]);

		coalescer.settle();
		clock.tick();
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it('cancel drops the queued value', () => {
		const clock = frameClock();
		const apply = vi.fn();
		const coalescer = createAnimationFrameCoalescer<number>(apply, clock.schedule, clock.unschedule);

		coalescer.push(1);
		coalescer.cancel();
		clock.tick();
		expect(apply).not.toHaveBeenCalled();
	});
});
