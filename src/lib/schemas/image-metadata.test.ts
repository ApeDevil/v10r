import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
	analysisIsEmpty,
	emptyImageMetadata,
	type ImageAnalysis,
	imageAnalysisSchema,
	imageMetadataSaveSchema,
} from './image-metadata';

const validSave = {
	imageId: 'img-1',
	title: 'A red bicycle',
	caption: 'A red bicycle leaning on a brick wall.',
	altText: 'Red bicycle leaning against a weathered brick wall',
	keywords: ['bicycle', 'red', 'wall'],
	category: 'photo' as const,
	includeLocation: false,
	gpsLat: null,
	gpsLng: null,
};

describe('imageMetadataSaveSchema', () => {
	it('accepts a fully valid record', () => {
		const r = v.safeParse(imageMetadataSaveSchema, validSave);
		expect(r.success).toBe(true);
	});

	it('requires a non-empty title', () => {
		const r = v.safeParse(imageMetadataSaveSchema, { ...validSave, title: '   ' });
		expect(r.success).toBe(false);
	});

	it('requires alt text for accessibility', () => {
		const r = v.safeParse(imageMetadataSaveSchema, { ...validSave, altText: '' });
		expect(r.success).toBe(false);
	});

	it('rejects an unknown category', () => {
		const r = v.safeParse(imageMetadataSaveSchema, { ...validSave, category: 'meme' });
		expect(r.success).toBe(false);
	});

	it('caps keyword count at 25', () => {
		const keywords = Array.from({ length: 26 }, (_, i) => `k${i}`);
		const r = v.safeParse(imageMetadataSaveSchema, { ...validSave, keywords });
		expect(r.success).toBe(false);
	});

	it('rejects out-of-range GPS coordinates', () => {
		const r = v.safeParse(imageMetadataSaveSchema, { ...validSave, includeLocation: true, gpsLat: 120, gpsLng: 0 });
		expect(r.success).toBe(false);
	});

	it('defaults caption and includeLocation when omitted', () => {
		const { caption, includeLocation, ...rest } = validSave;
		const r = v.safeParse(imageMetadataSaveSchema, rest);
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.output.caption).toBe('');
			expect(r.output.includeLocation).toBe(false);
		}
	});
});

describe('imageAnalysisSchema', () => {
	const fullConfidence = {
		title: 'high' as const,
		caption: 'medium' as const,
		altText: 'high' as const,
		keywords: 'medium' as const,
		category: 'low' as const,
	};

	it('accepts null content fields (AI could not determine)', () => {
		const r = v.safeParse(imageAnalysisSchema, {
			title: null,
			caption: null,
			altText: null,
			keywords: [],
			category: null,
			confidence: { ...fullConfidence, title: 'low', altText: 'low', caption: 'low', keywords: 'low' },
		});
		expect(r.success).toBe(true);
	});

	it('requires a confidence bucket for every field', () => {
		const r = v.safeParse(imageAnalysisSchema, {
			title: 'x',
			caption: null,
			altText: 'y',
			keywords: [],
			category: 'photo',
			confidence: { title: 'high' }, // incomplete
		});
		expect(r.success).toBe(false);
	});
});

describe('analysisIsEmpty', () => {
	const base: ImageAnalysis = {
		title: null,
		caption: null,
		altText: null,
		keywords: [],
		category: null,
		confidence: { title: 'low', caption: 'low', altText: 'low', keywords: 'low', category: 'low' },
	};

	it('is true when every content field is empty', () => {
		expect(analysisIsEmpty(base)).toBe(true);
	});

	it('is false when any content field is populated', () => {
		expect(analysisIsEmpty({ ...base, altText: 'a cat' })).toBe(false);
		expect(analysisIsEmpty({ ...base, keywords: ['cat'] })).toBe(false);
	});
});

describe('emptyImageMetadata', () => {
	it('produces a record that passes the save schema once title/altText are filled', () => {
		const blank = emptyImageMetadata('img-9');
		expect(blank.imageId).toBe('img-9');
		const filled = { ...blank, title: 'T', altText: 'A' };
		expect(v.safeParse(imageMetadataSaveSchema, filled).success).toBe(true);
	});
});
