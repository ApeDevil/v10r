---
name: Global module state leaks in AI providers
description: The cooldowns and userPreferences Maps in providers.ts are module-level singletons with no reset API; test isolation requires manual cleanup in afterEach
type: project
---

The `cooldowns` Map in `src/lib/server/ai/providers.ts` is module-level and not exported.
There is no `clearCooldown()` or `resetCooldowns()` function. Tests that call `markCooldown()`
must manually expire entries via `markCooldown(id, 0); getCooldownResumeAt(id)` in afterEach.

**Why:** Proven by "test B sees groq as cooled down" test in providers-issues.test.ts, which
passes because cooldown set in test A bleeds into test B.

**How to apply:** When writing tests for any function that touches cooldowns, always add
afterEach cleanup. Consider proposing a `resetAllCooldowns()` export for test use.
