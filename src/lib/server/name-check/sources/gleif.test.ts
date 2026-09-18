import { describe, expect, it } from 'vitest';
import { toGleifDrafts } from './gleif';

describe('toGleifDrafts', () => {
	it('maps full records before completions, with the country and status a record carries', () => {
		const drafts = toGleifDrafts(
			{
				data: [
					{
						attributes: {
							lei: '984500F8295F478CE191',
							entity: {
								legalName: { name: 'Velora OÜ' },
								otherNames: [{ name: 'Velora' }],
								jurisdiction: 'EE',
								legalAddress: { country: 'EE' },
								status: 'ACTIVE',
							},
						},
					},
					{ attributes: { lei: 'X', entity: { legalName: { name: '  ' } } } },
				],
			},
			{
				data: [
					{ attributes: { value: 'VELTRA' }, relationships: { 'lei-records': { data: { id: '5299000ABC' } } } },
					{ attributes: { value: '' } },
				],
			},
		);

		expect(drafts).toEqual([
			{
				sourceId: 'gleif',
				kind: 'company',
				label: 'Velora OÜ',
				aliases: ['Velora'],
				jurisdiction: 'EE',
				externalId: '984500F8295F478CE191',
				url: 'https://search.gleif.org/#/record/984500F8295F478CE191',
				status: 'ACTIVE',
				active: true,
			},
			{
				sourceId: 'gleif',
				kind: 'company',
				label: 'VELTRA',
				aliases: [],
				jurisdiction: null,
				externalId: '5299000ABC',
				url: 'https://search.gleif.org/#/record/5299000ABC',
				status: null,
				active: false,
			},
		]);
	});

	it('reduces a US-DE style jurisdiction to its country', () => {
		const [draft] = toGleifDrafts(
			{ data: [{ attributes: { lei: 'L', entity: { legalName: { name: 'Velora Inc' }, jurisdiction: 'US-DE' } } }] },
			null,
		);
		expect(draft?.jurisdiction).toBe('US');
	});
});
