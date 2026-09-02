/**
 * PERSONAL DATA REPORT — the single source of truth for "all data we hold
 * about this user" (GDPR Art 15 access / Art 20 portability).
 *
 * One aggregator, many consumers: the /account/data page load, the
 * /api/account/data + /api/account/data/export endpoints, and a future AI
 * `get_my_data` tool. Surfaces must never
 * hand-assemble this — they call collectUserData() so the definition of
 * "all my data" cannot drift between them.
 *
 * Import direction: this module reads ONLY from $lib/server/db (the import
 * sink) — never from peer domains.
 *
 * Hard rules (compliance, not style):
 * - Secret columns (account tokens, session.token, password) are projected
 *   out at query level — only presence/scope/expiry may appear here.
 * - Prior-session IPs are masked (Art 15(4): a shared device means a
 *   historical IP can be a third party's data). The CURRENT session is
 *   shown in full — it is the requester's own connection.
 * - Each section degrades independently (settle() wrapper): one failed
 *   read renders that section unavailable, it never 500s the whole report.
 * - Analytics comes in TWO lanes and only one of them belongs here.
 *   `analytics.user_events` IS included (`behavior` section): it is keyed by
 *   user id, so it is plainly this user's data under Art 15.
 *   `analytics.events` is deliberately ABSENT: it is keyed by a hashed
 *   visitorId, and re-identifying that hash requires a documented Art 6(4)
 *   basis that does not exist. Do not add it without one — and note that
 *   joining the two lanes would not merely widen this report, it would move
 *   the anonymous lane onto a different legal footing entirely.
 */
import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { getPreferences } from '$lib/server/db/preferences';
import { conversation } from '$lib/server/db/schema/ai/conversation';
import { userEvents } from '$lib/server/db/schema/analytics';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { comment } from '$lib/server/db/schema/blog/comment';
import { file as deskFile } from '$lib/server/db/schema/desk/file';
import { deskWorkspace } from '$lib/server/db/schema/desk/workspace';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import { customPalettes } from '$lib/server/db/schema/personalization/custom-palettes';
import { imageAsset, imageMetadata } from '$lib/server/db/schema/showcase/image-metadata';
import { getUserOAuthSummary, getUserProfile, getUserSessions, listPasskeyDtos } from '$lib/server/db/user';

export const REPORT_SCHEMA_VERSION = '2026-07-25';

/** Legal basis per domain — Art 20 portability applies only to consent/contract data. */
export type LegalBasis = 'contract' | 'consent' | 'legitimate_interest';

interface Section<T> {
	available: boolean;
	basis: LegalBasis;
	/** True when the user can take this domain with them (GDPR Art 20). */
	portable: boolean;
	data: T | null;
}

export interface PersonalDataReport {
	meta: {
		schemaVersion: string;
		userId: string;
		generatedAt: string;
		art15: true;
	};
	identity: Section<{
		id: string;
		name: string;
		email: string;
		emailVerified: boolean;
		image: string | null;
		createdAt: string;
	}>;
	sessions: Section<{
		current: SessionEntry | null;
		prior: SessionEntry[];
	}>;
	oauthAccounts: Section<
		{
			provider: string;
			scope: string | null;
			linkedAt: string | null;
			hasAccessToken: boolean;
			hasRefreshToken: boolean;
			accessTokenExpiresAt: string | null;
		}[]
	>;
	preferences: Section<Record<string, unknown> | null>;
	/**
	 * Counts only, and therefore `portable: false`. Conversation transcripts and
	 * desk file contents are bulk user data that belongs in a dedicated export,
	 * not inline in this summary — claiming Art-20 portability for a tally would
	 * be a false claim about what the user actually received.
	 */
	ai: Section<{ conversationCount: number; totalTokens: number }>;
	/** Counts only — see the note on `ai`. */
	desk: Section<{ workspaceCount: number; fileCount: number }>;
	notifications: Section<{ telegramLinked: boolean; discordLinked: boolean }>;
	/** Full comment bodies — small, user-authored, genuinely portable. */
	blogComments: Section<{
		count: number;
		items: Array<{
			postId: string;
			locale: string;
			body: string;
			status: string;
			createdAt: Date;
			editedAt: Date | null;
		}>;
	}>;
	/** Full palette definitions — the user's own design work. */
	palettes: Section<{
		count: number;
		items: Array<{
			id: string;
			name: string;
			description: string;
			basePaletteId: string;
			lightColors: Record<string, string>;
			darkColors: Record<string, string>;
			accentOffset: number;
			createdAt: Date;
		}>;
	}>;
	/**
	 * Image Metadata Reader. withGpsCount = records where the user opted to
	 * persist location. Counts only — see the note on `ai`.
	 */
	images: Section<{ imageCount: number; metadataCount: number; withGpsCount: number }>;
	/**
	 * Authenticated-lane analytics (`analytics.user_events`) — how this user has
	 * used their own account area. NOT the anonymous visitor trail, which stays
	 * out of this report by design.
	 */
	behavior: Section<{
		eventCount: number;
		firstSeen: string | null;
		lastSeen: string | null;
		topRoutes: { route: string; count: number }[];
	}>;
	security: Section<{
		twoFactorEnabled: boolean;
		passkeys: {
			name: string | null;
			authenticatorLabel: string | null;
			deviceType: string;
			backedUp: boolean;
			createdAt: string | null;
			lastUsedAt: string | null;
		}[];
	}>;
}

interface SessionEntry {
	createdAt: string;
	expiresAt: string;
	/** Current session: raw. Prior sessions: masked to 2 octets/groups. */
	ipAddress: string | null;
	userAgent: string | null;
	isCurrent: boolean;
}

/** Mask an IP for third-party-safe display: keep 2 octets (v4) / 2 groups (v6). */
export function maskIp(ip: string): string {
	if (ip.includes(':')) {
		const parts = ip.split(':');
		return `${parts.slice(0, 2).join(':')}:xxxx:xxxx:xxxx:xxxx`;
	}
	const parts = ip.split('.');
	return `${parts[0]}.${parts[1]}.xxx.xxx`;
}

/** Wrap a section read so a failure degrades to unavailable instead of throwing. */
async function settle<T>(basis: LegalBasis, portable: boolean, read: () => Promise<T>): Promise<Section<T>> {
	try {
		return { available: true, basis, portable, data: await read() };
	} catch (err) {
		console.error('[privacy] section read failed:', err);
		return { available: false, basis, portable, data: null };
	}
}

async function countWhere(read: () => Promise<{ value: number }[]>): Promise<number> {
	const [row] = await read();
	return row?.value ?? 0;
}

export async function collectUserData(
	userId: string,
	opts: { currentSessionId?: string } = {},
): Promise<PersonalDataReport> {
	const [
		identity,
		sessions,
		oauthAccounts,
		preferences,
		ai,
		desk,
		notifications,
		blogComments,
		palettes,
		images,
		behavior,
		security,
	] = await Promise.all([
		settle('contract', true, async () => {
			const profile = await getUserProfile(userId);
			if (!profile) throw new Error('profile missing');
			return {
				id: profile.id,
				name: profile.name,
				email: profile.email,
				emailVerified: profile.emailVerified,
				image: profile.image,
				createdAt: profile.createdAt.toISOString(),
			};
		}),
		settle('contract', false, async () => {
			const rows = await getUserSessions(userId);
			const toEntry = (s: (typeof rows)[number], isCurrent: boolean): SessionEntry => ({
				createdAt: s.createdAt.toISOString(),
				expiresAt: s.expiresAt.toISOString(),
				ipAddress: s.ipAddress ? (isCurrent ? s.ipAddress : maskIp(s.ipAddress)) : null,
				userAgent: s.userAgent,
				isCurrent,
			});
			const current = rows.find((s) => s.id === opts.currentSessionId);
			return {
				current: current ? toEntry(current, true) : null,
				prior: rows.filter((s) => s.id !== opts.currentSessionId).map((s) => toEntry(s, false)),
			};
		}),
		settle('contract', false, async () => {
			const rows = await getUserOAuthSummary(userId);
			return rows.map((a) => ({
				provider: a.provider,
				scope: a.scope,
				linkedAt: a.linkedAt?.toISOString() ?? null,
				hasAccessToken: a.hasAccessToken,
				hasRefreshToken: a.hasRefreshToken,
				accessTokenExpiresAt: a.accessTokenExpiresAt?.toISOString() ?? null,
			}));
		}),
		settle('consent', true, async () => {
			const row = await getPreferences(userId);
			if (!row) return null;
			const { userId: _omit, ...rest } = row;
			return rest as Record<string, unknown>;
		}),
		// portable: false — a count is not the data. See the `ai` field comment.
		settle('consent', false, async () => {
			const [row] = await db
				.select({
					value: count(),
					totalTokens: sql<number>`COALESCE(SUM(${conversation.totalInputTokens} + ${conversation.totalOutputTokens}), 0)`,
				})
				.from(conversation)
				.where(eq(conversation.userId, userId));
			return { conversationCount: row?.value ?? 0, totalTokens: row?.totalTokens ?? 0 };
		}),
		settle('consent', false, async () => {
			const [workspaceCount, fileCount] = await Promise.all([
				countWhere(() => db.select({ value: count() }).from(deskWorkspace).where(eq(deskWorkspace.userId, userId))),
				countWhere(() =>
					db
						.select({ value: count() })
						.from(deskFile)
						.where(and(eq(deskFile.userId, userId), isNull(deskFile.deletedAt))),
				),
			]);
			return { workspaceCount, fileCount };
		}),
		settle('consent', false, async () => {
			const [telegram, discord] = await Promise.all([
				countWhere(() =>
					db.select({ value: count() }).from(userTelegramAccounts).where(eq(userTelegramAccounts.userId, userId)),
				),
				countWhere(() =>
					db.select({ value: count() }).from(userDiscordAccounts).where(eq(userDiscordAccounts.userId, userId)),
				),
			]);
			return { telegramLinked: telegram > 0, discordLinked: discord > 0 };
		}),
		// Comments and palettes return the ACTUAL content, not a tally: Art 20
		// portability means the user receives their data, and a count is not data.
		// Both are small and unambiguously user-authored, so they travel in full.
		settle('consent', true, async () => {
			const items = await db
				.select({
					postId: comment.postId,
					locale: comment.locale,
					body: comment.body,
					status: comment.status,
					createdAt: comment.createdAt,
					editedAt: comment.editedAt,
				})
				.from(comment)
				.where(eq(comment.authorId, userId))
				.orderBy(comment.createdAt);
			return { count: items.length, items };
		}),
		settle('consent', true, async () => {
			const items = await db
				.select({
					id: customPalettes.id,
					name: customPalettes.name,
					description: customPalettes.description,
					basePaletteId: customPalettes.basePaletteId,
					lightColors: customPalettes.lightColors,
					darkColors: customPalettes.darkColors,
					accentOffset: customPalettes.accentOffset,
					createdAt: customPalettes.createdAt,
				})
				.from(customPalettes)
				.where(eq(customPalettes.createdBy, userId))
				.orderBy(customPalettes.createdAt);
			return { count: items.length, items };
		}),
		// Image Metadata Reader. GPS lives in a typed column (never only inside a
		// blob), so location persistence is countable here — the canonical home the
		// aggregator must query. withGpsCount reflects records where the user opted in.
		// portable: false — counts only; the images themselves are not in this report.
		settle('consent', false, async () => {
			const [imageCount, metadataCount, withGpsCount] = await Promise.all([
				countWhere(() => db.select({ value: count() }).from(imageAsset).where(eq(imageAsset.userId, userId))),
				countWhere(() =>
					db
						.select({ value: count() })
						.from(imageMetadata)
						.innerJoin(imageAsset, eq(imageMetadata.imageId, imageAsset.id))
						.where(and(eq(imageAsset.userId, userId), isNull(imageMetadata.deletedAt))),
				),
				countWhere(() =>
					db
						.select({ value: count() })
						.from(imageMetadata)
						.innerJoin(imageAsset, eq(imageMetadata.imageId, imageAsset.id))
						.where(
							and(eq(imageAsset.userId, userId), isNull(imageMetadata.deletedAt), isNotNull(imageMetadata.gpsLat)),
						),
				),
			]);
			return { imageCount, metadataCount, withGpsCount };
		}),
		// Authenticated-lane analytics. Basis is legitimate interest (improving the
		// product), NOT consent — the consent banner governs the anonymous visitor
		// lane only, and that lane is deliberately not reachable from here.
		// Portable: it is observed behavioural data about the user, and Art 20
		// covers data "provided by" the data subject, which the EDPB reads to
		// include observed activity.
		settle('legitimate_interest', true, async () => {
			const [totals, topRoutes] = await Promise.all([
				db
					.select({
						eventCount: count(),
						firstSeen: sql<string | null>`min(${userEvents.timestamp})::text`,
						lastSeen: sql<string | null>`max(${userEvents.timestamp})::text`,
					})
					.from(userEvents)
					.where(eq(userEvents.userId, userId)),
				db
					.select({ route: userEvents.route, count: sql<number>`count(*)::int` })
					.from(userEvents)
					.where(eq(userEvents.userId, userId))
					.groupBy(userEvents.route)
					.orderBy(sql`count(*) desc`)
					.limit(10),
			]);
			const row = totals[0];
			return {
				eventCount: Number(row?.eventCount ?? 0),
				firstSeen: row?.firstSeen ?? null,
				lastSeen: row?.lastSeen ?? null,
				topRoutes: topRoutes.map((r) => ({ route: r.route, count: Number(r.count) })),
			};
		}),
		// Security credentials are not Art-20-portable (a passkey cannot be
		// "taken elsewhere"); TOTP secret/backupCodes never appear, even
		// encrypted — only enrollment state and passkey display metadata.
		settle('contract', false, async () => {
			const [profileRow, passkeys] = await Promise.all([
				db.select({ twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)),
				listPasskeyDtos(userId),
			]);
			return {
				twoFactorEnabled: !!profileRow[0]?.twoFactorEnabled,
				passkeys: passkeys.map((p) => ({
					name: p.name,
					authenticatorLabel: p.authenticatorLabel,
					deviceType: p.deviceType,
					backedUp: p.backedUp,
					createdAt: p.createdAt?.toISOString() ?? null,
					lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
				})),
			};
		}),
	]);

	return {
		meta: {
			schemaVersion: REPORT_SCHEMA_VERSION,
			userId,
			generatedAt: new Date().toISOString(),
			art15: true,
		},
		identity,
		sessions,
		oauthAccounts,
		preferences,
		ai,
		desk,
		notifications,
		blogComments,
		palettes,
		images,
		behavior,
		security,
	};
}
