import type { PageServerLoad } from './$types';
import { getBrandConfig } from '$lib/server/style/brand';

export const load: PageServerLoad = async () => {
	let brand: { paletteId: string; typographyId: string; radiusId: string; enabled: boolean } | null = null;

	try {
		const config = await getBrandConfig();
		if (config) {
			brand = {
				paletteId: config.style.paletteId,
				typographyId: config.style.typographyId,
				radiusId: config.style.radiusId,
				enabled: config.enabled,
			};
		}
	} catch {
		// DB unreachable — brand status unknown
	}

	return { brand };
};
