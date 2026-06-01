import { describe, expect, it } from 'vitest';
import { deriveCatalogGraph } from './catalog-projection';

describe('deriveCatalogGraph', () => {
	const { resources, edges } = deriveCatalogGraph();
	const byId = new Map(resources.map((r) => [r.id, r]));

	it('types a top-level showcase card as a domain', () => {
		expect(byId.get('showcase:/showcases/ui')?.kind).toBe('domain');
	});

	it('types a sublink as a module', () => {
		expect(byId.get('showcase:/showcases/ui/components')?.kind).toBe('module');
	});

	it('types a nested child as a component', () => {
		expect(byId.get('showcase:/showcases/ui/components/primitives')?.kind).toBe('component');
	});

	it('links component PART_OF module', () => {
		expect(edges).toContainEqual({
			from: 'showcase:/showcases/ui/components/primitives',
			to: 'showcase:/showcases/ui/components',
			type: 'PART_OF',
		});
	});

	it('links module PART_OF domain', () => {
		expect(edges).toContainEqual({
			from: 'showcase:/showcases/ui/components',
			to: 'showcase:/showcases/ui',
			type: 'PART_OF',
		});
	});

	it('links a section PART_OF its owning showcase page', () => {
		const sectionId = 'section:/showcases/ui/menus#menu-command-palette';
		expect(byId.get(sectionId)?.kind).toBe('section');
		expect(edges).toContainEqual({ from: sectionId, to: 'showcase:/showcases/ui/menus', type: 'PART_OF' });
	});

	it('produces unique node ids and no self-edges', () => {
		expect(resources.length).toBe(new Set(resources.map((r) => r.id)).size);
		expect(edges.every((e) => e.from !== e.to)).toBe(true);
	});
});
