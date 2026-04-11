---
name: Global module state in AI providers — cooldowns fixed, userPreferences not
description: resetCooldowns() is now exported and used in afterEach; userPreferences Map still has no per-test cleanup
type: project
---

The `cooldowns` Map issue is resolved. `resetCooldowns()` is exported from `providers.ts` and
called in `afterEach` in `providers.test.ts`. Cross-test isolation for cooldowns is correct.

The `userPreferences` Map is also module-level. There is no `resetUserPreferences()` export.
Tests for `setUserPreference` / `clearUserPreference` currently use `clearUserPreference` per-user
in `beforeEach`, which works as long as test user IDs don't collide across describe blocks.
If a future test sets preferences without cleanup, it will bleed. Consider exporting `resetAllPreferences()`.

**How to apply:** When writing new tests that call `setUserPreference`, ensure `clearUserPreference`
is called in beforeEach/afterEach. Don't rely on test-order-independent isolation for preferences.
