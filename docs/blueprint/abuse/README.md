# Anti-Abuse

Four-layer defense against bot traffic, spam, and cost-amplification abuse. All layers share the `Decision` type from `$lib/server/abuse/` and honor `BOT_DETECTION_MODE` for safe rollout and emergency bypass.

Live showcase: `/showcases/abuse`

## Files

| File | Topics |
|------|--------|
| **[captcha.md](./captcha.md)** | • ALTCHA proof-of-work: server lib, HMAC contract, PBKDF2/SHA-256 cost 100k<br>• Replay store (Upstash, `altcha:nonce:`, 600s TTL)<br>• `/api/captcha/challenge` endpoint, per-IP 30/60s limit<br>• `<Altcha />` composite: `challenge` attribute (v3), `configure()` gotcha<br>• `BOT_DETECTION_MODE` kill switch, `assertProductionConfig` fail-closed |
| **[honeypot.md](./honeypot.md)** | • Hidden `bookmark` field: filled by bots, blank for real users<br>• 2000ms minimum fill time<br>• `checkHoneypot()` API, where wired (feedback form) |
| **[rate-limits.md](./rate-limits.md)** | • `createLimiter` factory: `@upstash/ratelimit` sliding window<br>• Per-email limiter: sha256 hash, 5/hr, prefix `rl:abuse:email`<br>• Per-IP captcha challenge limiter: 30/60s, prefix `rl:captcha:challenge`<br>• Auth hook gating: captcha + per-email on magic-link and OTP send paths<br>• Comment limiters: 5/min + 30/hr per user, 20/hr per IP, 60/min per post<br>• Grant-request limiter: 1/24h per user; admin grant actions: 30/min<br>• Fail-closed behavior when Redis is unavailable in production |
| **[ai-budget.md](./ai-budget.md)** | • Daily token cap (`AI_DAILY_TOKEN_CAP = 100_000`)<br>• Redis key shape: `ai:budget:{userId}:{YYYY-MM-DD}`, 25h TTL<br>• `checkUserBudget` + `chargeTokens` pattern, where enforced<br>• Check-then-charge caveat (v1 known overshoot) |
