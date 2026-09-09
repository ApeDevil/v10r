/**
 * The security primitives other domains are allowed to reach for.
 *
 * Everything here is a keyed construction over `BETTER_AUTH_SECRET`: derive a
 * purpose-separated subkey, or MAC a set of server-chosen facts for a bounded time.
 * Four domains now sign something — analytics visitor hashes, analytics confirm
 * tokens, blog upload tickets, the debug-owner pairing cookie — and they all reach
 * one implementation through this barrel rather than by file.
 *
 * Two neighbours are deliberately NOT re-exported:
 *
 *  - `config.ts` is a policy leaf. Taking `HSTS_MAX_AGE` through a barrel would drag
 *    this module's whole graph behind a single constant, which is exactly what the
 *    architecture gate's policy-leaf exemption for `config.ts` files exists to avoid.
 *  - `csrf.ts` is consumed only by the composition root (`hooks.server.ts`), so it has
 *    no cross-domain surface to publish.
 */
export { deriveSubkey, resetSubkeyCache, SUBKEY_PURPOSES, type SubkeyPurpose } from './subkey';
export { signTicket, type TicketCheck, type TicketFields, verifyTicket } from './ticket';
