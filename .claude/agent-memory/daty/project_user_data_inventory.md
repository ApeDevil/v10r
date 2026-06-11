---
name: user-data-inventory
description: Authoritative map of every table/store holding user or visitor data, keyed by user.id vs hashed visitorId; what a GDPR aggregator must cover and what to never echo
metadata:
  type: project
---

Cross-schema inventory of all personal data at rest (verified against src/lib/server/db/schema/** 2026-06-11), built for the post-signup transparency-page consult.

**USER-KEYED (FK auth.user.id, ON DELETE cascade unless noted):**
- auth.session — RAW ipAddress + userAgent (unhashed), token (SECRET, never echo), impersonatedBy
- auth.account — accessToken/refreshToken/idToken/password (SECRETS, never echo), scope, provider, expiresAt
- auth.user — name/email/role/banned; createdAt===updatedAt at signup (NOT a reliable first-signup signal, Better Auth bumps updatedAt in same txn)
- app.user_preferences — PK=userId, no onboarding/welcome column today
- app.custom_palettes, app.brand_settings
- ai.conversation (index conversation_user_updated_idx on userId,updatedAt) → message → tool_call → conversation_step (provider_id/model_id/duration_ms telemetry)
- desk.file (userId FK; soft-delete deletedAt; index desk_file_user_updated_idx) + folder/spreadsheet/markdown/theme/workspace
- notifications.user_telegram_accounts (telegramChatId+username PII), discord, settings, deliveries
- blog.comment, feedback (also email/sessionId bridge), auth.grant/grant_request, admin+ai audit-log

**VISITOR-KEYED (NO user FK — keyed by hashed visitorId + _v10r_sid cookie):**
- analytics.events, analytics.sessions, analytics.consent_events. Every user.id col here is admin/debug ONLY (events.debugOwnerId, sessions.pairedAdminUserId set-null). NO visitor→user link table exists anywhere.
- visitorId = 'v_'+first16hex SHA-256(ip:ua) (hashVisitorId in src/lib/server/analytics/consent.ts). Pure function → recomputable at request time from getClientAddress()+UA, but stored back-reference does NOT exist.

**NEO4J (Aura):** ONLY :Chunk/:Entity/:Resource nodes keyed by pgId (RAG content + catalog graph, src/lib/server/graph/rag/mutations.ts). NO :User node, no VIEWED edge, no per-user data. Out of scope for any user-data-mirror.

**Why:** a cross-schema GDPR aggregator (collectUserData) must cover the user-keyed half; the visitor-keyed half is a live-recompute-only display, never a stored link. **How to apply:** when building export/transparency/erasure, fan out per schema on indexed userId; project OUT all secret columns (session.token, account.*Token, account.password); query analytics via sessions-by-visitorId then events-by-sessionId (no visitorId index on events).
