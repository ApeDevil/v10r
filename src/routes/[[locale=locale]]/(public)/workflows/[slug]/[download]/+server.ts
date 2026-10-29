import { error } from '@sveltejs/kit';
import { isLocale } from '#lib/i18n/index.ts';
import { buildStarterFolder } from '#lib/server/workflows/index.ts';
import type { RequestHandler } from './$types';

/**
 * `/workflows/<slug>/starter-<locale>.zip` — the tutorial's example folder, ready to unpack.
 * The language is in the file name, not taken from the request, so a link in a tutorial
 * always downloads the folder that tutorial describes.
 */
const STARTER_FILE = /^starter-([a-z]{2})\.zip$/;

export const GET: RequestHandler = async ({ params }) => {
	const locale = STARTER_FILE.exec(params.download)?.[1];
	if (!locale || !isLocale(locale)) throw error(404, 'Not found');

	const starter = await buildStarterFolder(params.slug, locale);
	if (!starter) throw error(404, 'Not found');

	return new Response(new Blob([new Uint8Array(starter.zip)]), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${starter.folderName}.zip`)}`,
			'Cache-Control': 'public, max-age=0, s-maxage=86400',
		},
	});
};
