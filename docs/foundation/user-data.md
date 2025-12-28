# User Data Classification

Canonical definitions for user data categories. Other docs reference these terms.

---

## Account Data

Data establishing user existence and representation.

### User Identity Data (private)

Core account identifiers. Who the user *is* - email, user ID, name. Required for account existence. Never public without explicit consent.

### User Profile Data (public)

Self-presentation information. What the user *shows* - bio, avatar, website, social links. Visibility controlled by user.

---

## User Configuration

User-controlled customization.

### Preferences

UX customization choices. How the user *experiences* the app - theme, language, density, timezone. Affects presentation, not functionality.

### Settings

Feature configuration toggles. How the user *uses* features - notification channels, default visibility, auto-save behavior. Affects functionality, not presentation.

---

## User Content

What the user *creates*. Items, files, posts, comments - owned by the user. Subject to export and deletion rights.

---

## Authorization Data

What the user *can do*. Roles, permissions, group memberships, feature flags. Determines access boundaries.

---

## Security Data

How the user *proves identity*. Password hashes, 2FA secrets, sessions, OAuth tokens, trusted devices. Never exported. Rotate or revoke, never expose.

---

## Consent & Compliance Data

What the user *agreed to*. Terms acceptance, cookie choices, marketing opt-ins, data processing consent. Immutable audit log - records kept even after account deletion.

---

## Operational Data

What the *system observes*. Request logs, error traces, performance metrics, feature usage analytics. User is subject, not author. Retention policies apply.

---

## Derived Data

What we *compute*. Recommendations, scores, embeddings, aggregations. Generated from other categories. May require separate consent for AI/ML processing.
