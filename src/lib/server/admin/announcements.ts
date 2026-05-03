import { and, count, desc, eq, sql } from 'drizzle-orm';
import { ADMIN_ANNOUNCEMENT_CACHE_TTL_MS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { announcementDismissals, announcements } from '$lib/server/db/schema/admin';
import { user } from '$lib/server/db/schema/auth/_better-auth';

// ── Types ────────────────────────────────────────────────────────────────────

import type { TranslationMap } from '$lib/i18n';

export interface ActiveAnnouncement {
	id: string;
	title: string;
	body: string;
	titleI18n: TranslationMap;
	bodyI18n: TranslationMap;
	severity: 'info' | 'warning' | 'critical';
	startsAt: Date | null;
	endsAt: Date | null;
	createdAt: Date;
}

/**
 * Locale-resolved view passed to UI components.
 * Created at the layout edge by mapping `tc()` over `ActiveAnnouncement`.
 */
export interface ResolvedAnnouncement {
	id: string;
	title: string;
	body: string;
	severity: 'info' | 'warning' | 'critical';
	startsAt: Date | null;
	endsAt: Date | null;
	createdAt: Date;
}

export interface AnnouncementAdminView {
	id: string;
	title: string;
	body: string;
	severity: 'info' | 'warning' | 'critical';
	active: boolean;
	startsAt: Date | null;
	endsAt: Date | null;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
	dismissedCount: number;
	acknowledgedCount: number;
	totalUsers: number;
}

export interface CreateAnnouncementInput {
	title: string;
	body: string;
	severity: 'info' | 'warning' | 'critical';
	startsAt?: Date | null;
	endsAt?: Date | null;
	createdBy: string;
}

// ── In-Process Cache ─────────────────────────────────────────────────────────

const cache = new Map<string, { data: ActiveAnnouncement[]; cachedAt: number }>();

export function invalidateAnnouncementCache(): void {
	cache.clear();
}

export function getAnnouncementCacheSize(): number {
	return cache.size;
}

// ── Read (User-facing, cached) ───────────────────────────────────────────────

export async function getActiveAnnouncements(userId: string): Promise<ActiveAnnouncement[]> {
	const cached = cache.get(userId);
	if (cached && Date.now() - cached.cachedAt < ADMIN_ANNOUNCEMENT_CACHE_TTL_MS) {
		return cached.data;
	}

	const now = new Date();

	const rows = await db
		.select({
			id: announcements.id,
			title: announcements.title,
			body: announcements.body,
			titleI18n: announcements.titleI18n,
			bodyI18n: announcements.bodyI18n,
			severity: announcements.severity,
			startsAt: announcements.startsAt,
			endsAt: announcements.endsAt,
			createdAt: announcements.createdAt,
		})
		.from(announcements)
		.where(
			and(
				eq(announcements.active, true),
				sql`(${announcements.startsAt} IS NULL OR ${announcements.startsAt} <= ${now})`,
				sql`(${announcements.endsAt} IS NULL OR ${announcements.endsAt} > ${now})`,
				sql`NOT EXISTS (
					SELECT 1 FROM admin.announcement_dismissals d
					WHERE d.announcement_id = ${announcements.id}
						AND d.user_id = ${userId}
						AND d.dismissed_at IS NOT NULL
				)`,
			),
		)
		.orderBy(desc(announcements.createdAt));

	cache.set(userId, { data: rows, cachedAt: Date.now() });
	return rows;
}

// ── Read (Admin-facing, uncached) ────────────────────────────────────────────

export async function getAllAnnouncementsAdmin(): Promise<AnnouncementAdminView[]> {
	const totalUsersResult = await db.select({ total: count() }).from(user);
	const totalUsers = totalUsersResult[0]?.total ?? 0;

	const rows = await db
		.select({
			id: announcements.id,
			title: announcements.title,
			body: announcements.body,
			severity: announcements.severity,
			active: announcements.active,
			startsAt: announcements.startsAt,
			endsAt: announcements.endsAt,
			createdBy: announcements.createdBy,
			createdAt: announcements.createdAt,
			updatedAt: announcements.updatedAt,
			dismissedCount: sql<number>`coalesce(
				(SELECT count(*) FROM admin.announcement_dismissals d
				 WHERE d.announcement_id = ${announcements.id} AND d.dismissed_at IS NOT NULL), 0
			)`,
			acknowledgedCount: sql<number>`coalesce(
				(SELECT count(*) FROM admin.announcement_dismissals d
				 WHERE d.announcement_id = ${announcements.id}
				   AND d.acknowledged_at IS NOT NULL AND d.dismissed_at IS NULL), 0
			)`,
		})
		.from(announcements)
		.orderBy(desc(announcements.createdAt));

	return rows.map((r) => ({
		...r,
		dismissedCount: Number(r.dismissedCount),
		acknowledgedCount: Number(r.acknowledgedCount),
		totalUsers,
	}));
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createAnnouncement(input: CreateAnnouncementInput) {
	const id = `ann_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

	const [created] = await db
		.insert(announcements)
		.values({
			id,
			title: input.title,
			body: input.body,
			severity: input.severity,
			startsAt: input.startsAt ?? null,
			endsAt: input.endsAt ?? null,
			createdBy: input.createdBy,
		})
		.returning();

	invalidateAnnouncementCache();
	return created;
}

export async function deactivateAnnouncement(id: string): Promise<void> {
	await db.update(announcements).set({ active: false, updatedAt: new Date() }).where(eq(announcements.id, id));

	invalidateAnnouncementCache();
}

export async function dismissAnnouncement(
	announcementId: string,
	userId: string,
	severity: 'info' | 'warning' | 'critical',
): Promise<void> {
	const now = new Date();

	await db
		.insert(announcementDismissals)
		.values({
			announcementId,
			userId,
			acknowledgedAt: now,
			// Critical: acknowledge only (banner stays). Info/warning: dismiss (banner goes).
			dismissedAt: severity === 'critical' ? null : now,
		})
		.onConflictDoNothing();

	// Invalidate this user's cache so the banner updates
	cache.delete(userId);
}

export async function getAnnouncementById(id: string) {
	const rows = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
	return rows[0] ?? null;
}
