# GDPR & Privacy

Data protection compliance for EU users.

## Requirements Overview

| Requirement | What It Means | Implementation |
|-------------|---------------|----------------|
| **Lawful Basis** | Need legal reason to process data | Consent or legitimate interest |
| **Consent** | Explicit opt-in before non-essential processing | Cookie banner, preference center |
| **Right to Access** | Users can view their data | `/account/data` page |
| **Right to Export** | Users can download their data | JSON export endpoint |
| **Right to Erasure** | Users can delete all their data | Account deletion flow |
| **Data Minimization** | Only collect what's necessary | Audit data collection |
| **Security** | Protect data appropriately | Encryption, access controls |

## Consent

Block non-essential cookies/scripts until user opts in. Showing a banner while setting cookies violates GDPR.

### Cookie Categories

| Category | Examples | Consent Required |
|----------|----------|------------------|
| **Necessary** | Session cookies, CSRF tokens | No (always allowed) |
| **Analytics** | Vercel Analytics, Plausible | Yes |
| **Marketing** | Ad pixels, retargeting | Yes |
| **Functional** | Theme preference, language | Depends on implementation |

### Implementation Options

| Solution | Type | Size | Cost |
|----------|------|------|------|
| **Klaro** | Self-hosted | ~15 KB | Free (MIT) |
| **Cookie Consent by Osano** | Widget | ~30 KB | Free tier |
| **Ketch** | Platform | External | Paid |
| **DIY** | Custom | ~2 KB | Free |

Klaro for full features, DIY for minimal footprint.

### DIY

Consent store in `src/lib/consent.svelte.ts` with Svelte runes. Store in localStorage. Functions: `initConsent()`, `setConsent()`, `hasConsent()`, `revokeConsent()`.

Banner shows on first visit. Options: "Necessary Only" and "Accept All".

Conditionally load scripts in `+layout.svelte` via `onMount()` and `hasConsent()`.

## User Rights

### Required Routes

| Route | Purpose | Right |
|-------|---------|-------|
| `/privacy` | Privacy policy | Transparency |
| `/account/data` | View stored data | Access |
| `/account/export` | Download JSON | Portability |
| `/account/delete` | Delete account | Erasure |
| `/account/preferences` | Manage consent | Consent |

### Export

Endpoint at `/account/export` gathers all user data (profile, posts, comments), removes sensitive fields (passwordHash), returns JSON with download headers.

### Deletion

Server action verifies identity, deletes all data in correct order (foreign keys), invalidates sessions, logs deletion for audit.

### Retention

| Data | Retention | Reason |
|------|-----------|--------|
| Active accounts | Until deletion | Service |
| Deleted accounts | 0 days | GDPR |
| Logs | 30 days | Debugging |
| Analytics | 26 months | Analysis |
| Backups | 30 days | Recovery |

Deleted data must be removed from backups or anonymized.

## Privacy by Design

### Minimization

Only collect what's required. Avoid phone, address, birth date, gender unless essential.

### Anonymization

Deleted users: replace email with `deleted-{userId}@anonymized.local`, displayName to "Deleted User", keep ID for integrity.

### Pseudonymization

Separate identity from usage. Users table has PII (email, name). Analytics references user_id without PII.

## Third-Party Services

All services must be GDPR-compliant with DPAs.

| Service | GDPR | DPA |
|---------|------|-----|
| **Vercel** | Yes | Available |
| **Neon** | Yes | Available |
| **Cloudflare R2** | Yes | Available |
| **Resend** | Yes | Available |
| **Sentry** | Yes | Available |

**New service checklist:**
- [ ] GDPR compliance page
- [ ] DPA available
- [ ] EU data residency (if required)
- [ ] Listed in privacy policy

## Privacy Policy

Include:

- [ ] What data collected
- [ ] Why (legal basis)
- [ ] Retention period
- [ ] Third parties
- [ ] User rights and how to exercise
- [ ] Data controller contact
- [ ] Cookie policy
- [ ] Last updated

## Enforcement & Penalties

| Violation Type | Maximum Fine |
|----------------|--------------|
| Minor (procedural) | 2% of global revenue or €10M |
| Major (rights violation) | 4% of global revenue or €20M |

Regulators actively enforce against:
- Cookie consent violations
- Missing/inadequate privacy policies
- Failure to honor deletion requests
- Data breaches without notification

## Implementation Checklist

### Phase 1: Foundation
- [ ] Privacy policy page
- [ ] Cookie consent banner
- [ ] Conditional script loading
- [ ] Data minimization audit

### Phase 2: User Rights
- [ ] View my data page
- [ ] Data export endpoint
- [ ] Account deletion flow
- [ ] Consent preference center

### Phase 3: Operations
- [ ] DPAs with all vendors
- [ ] Data retention policy
- [ ] Backup deletion process
- [ ] Breach notification procedure
- [ ] Regular compliance audits

## Stack Benefits

| Component | Benefit |
|-----------|---------|
| **Better Auth** | Self-hosted, full control, native Drizzle adapter |
| **Drizzle** | Easy export/deletion |
| **Vercel Analytics** | Cookieless default |
| **Neon** | EU region available |
| **Svelte Stores** | Client consent state |

Self-hosted auth, minimal tracking, full DB control, EU hosting.
