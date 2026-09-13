/**
 * Hold the execution environment open until in-flight work settles.
 *
 * A function deployed with Vercel's `supportsCancellation` is TERMINATED the moment the
 * client disconnects — the platform door `http/cancellation.ts` listens on — and any work
 * not handed to `waitUntil` is lost with it. The tail of a cancelled turn runs exactly then:
 * persist what streamed, charge what usage reports, close the message, all inside the same
 * promise the stream is awaiting. Handing that promise over as well keeps the environment
 * up until it settles. Off Vercel it is fire-and-forget on a promise someone already awaits.
 *
 * Unlike `deferAfterResponse` this starts nothing and reports nothing: the work is already
 * running and its awaiter handles the failure; the handed-over copy only swallows it so an
 * unhandled rejection cannot take the process down (SvelteKit #9785).
 */
import { waitUntil } from '@vercel/functions';

export function holdOpenUntil(inflight: Promise<unknown>): void {
	waitUntil(inflight.catch(() => undefined));
}
