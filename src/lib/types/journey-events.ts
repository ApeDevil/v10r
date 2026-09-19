/**
 * Client-safe vocabulary shared by the journey lane's collector (server) and
 * its emitters (client): the doors a command can come through. The server's
 * event allow-list (`$lib/server/analytics/event-schema.ts`) reads the enum
 * from here so the client cannot send a value the ingest would drop.
 */

export const COMMAND_VIA = ['menu', 'sheet', 'shortcut', 'palette', 'context-menu', 'bar'] as const;

/**
 * How a command reached its handler — the `via` property of `command_invoked`.
 * `bar` is the activity bar and its mobile drawer: the door most panel toggles
 * come through, without which View's counts would misread the toggles.
 */
export type CommandVia = (typeof COMMAND_VIA)[number];
