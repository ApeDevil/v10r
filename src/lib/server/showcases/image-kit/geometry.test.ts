import { describe, expect, it } from 'vitest';
import { largestRatioRect } from '$lib/schemas/showcase/image-kit';
import { snapToAspect } from './geometry';

describe('largestRatioRect', () => {
	it('1:1 on a landscape image is height-bound and square', () => {
		expect(largestRatioRect(1, 1024, 768)).toEqual({ width: 768, height: 768 });
	});

	it('16:9 on a 1024x768 image is width-bound', () => {
		// 16/9 ≈ 1.778 > 1024/768 ≈ 1.333 → width-bound
		const r = largestRatioRect(16 / 9, 1024, 768);
		expect(r.width).toBe(1024);
		expect(r.height).toBe(Math.round(1024 / (16 / 9))); // 576
	});

	it('9:16 (portrait ratio) on a landscape image is height-bound', () => {
		const r = largestRatioRect(9 / 16, 1024, 768);
		expect(r.height).toBe(768);
		expect(r.width).toBe(Math.round(768 * (9 / 16))); // 432
	});

	it('never exceeds the source dimensions', () => {
		const r = largestRatioRect(16 / 9, 400, 400);
		expect(r.width).toBeLessThanOrEqual(400);
		expect(r.height).toBeLessThanOrEqual(400);
	});
});

describe('snapToAspect', () => {
	const W = 1024;
	const H = 768;

	it('produces an exact-ratio, in-bounds rect for a valid focal point', () => {
		// focal near top-left
		const { rect, fallback } = snapToAspect([0.2, 0.2], [100, 100, 300, 300], '1:1', W, H);
		expect(fallback).toBe(false);
		expect(rect.width).toBe(768);
		expect(rect.height).toBe(768);
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.left + rect.width).toBeLessThanOrEqual(W);
		expect(rect.top + rect.height).toBeLessThanOrEqual(H);
	});

	it('clamps a focal point near the edge so the rect stays inside the image', () => {
		const { rect } = snapToAspect([0.99, 0.99], [0, 0, 0, 0], '16:9', W, H);
		expect(rect.left).toBe(W - rect.width);
		expect(rect.top).toBe(H - rect.height);
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
	});

	it('falls back to a centered crop when the box is [0,0,0,0] and focal is centre', () => {
		const { rect, fallback } = snapToAspect([0.5, 0.5], [0, 0, 0, 0], '1:1', W, H);
		expect(fallback).toBe(true);
		// centered square: left = (1024-768)/2 = 128, top = 0
		expect(rect).toEqual({ left: 128, top: 0, width: 768, height: 768 });
	});

	it('falls back on garbage / non-finite input without throwing', () => {
		const { rect, fallback } = snapToAspect([Number.NaN, Number.NaN], undefined, '9:16', W, H);
		expect(fallback).toBe(true);
		expect(rect.width).toBeGreaterThan(0);
		expect(rect.height).toBe(H);
	});

	it('honours y-first box order: a top-region box moves the crop up, not left', () => {
		// box across the full width but only the top third (ymin..ymax small), no focal
		const { rect } = snapToAspect([0.5, 0.5], [50, 0, 250, 1000], '16:9', W, H);
		// vertical centre of the box ≈ (50+250)/2/1000*768 ≈ 115 → crop top near 0 (clamped), not mid-image
		expect(rect.top).toBeLessThan(H / 2);
	});

	it('out-of-range box values are clamped, never overflow', () => {
		const { rect } = snapToAspect([1.5, -0.3], [2000, -100, 3000, 5000], '1:1', W, H);
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.left + rect.width).toBeLessThanOrEqual(W);
		expect(rect.top + rect.height).toBeLessThanOrEqual(H);
	});
});
