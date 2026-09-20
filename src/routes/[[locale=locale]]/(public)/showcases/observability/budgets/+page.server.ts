import { checkRatchets, isScoreable, scoreSnapshot, snapshot } from '$lib/server/perf';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	scored: scoreSnapshot(),
	ratchets: checkRatchets(),
	scoreable: isScoreable(),
	generatedAt: snapshot.generatedAt,
	nodeEnv: snapshot.nodeEnv,
});
