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

## AI Data Processing

The AI assistant processes user messages through third-party AI providers. Special considerations apply.

### Data Flow

```
User Message → Your Server → AI Provider → Response → User
              (no storage)   (processed)
```

### AI-Specific Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Consent** | Explicit opt-in before first AI use |
| **Transparency** | Disclose AI provider in privacy policy |
| **Right to Erasure** | Clear chat history on request |
| **Data Minimization** | Don't send unnecessary context |
| **Retention** | sessionStorage by default (ephemeral) |

### AI Consent Pattern

The AI assistant requires consent separate from general app consent. Implement a consent store in `$lib/stores/consent.svelte.ts` using Svelte runes with localStorage persistence. Functions needed: `hasAiConsent`, `grantAiConsent`, `revokeAiConsent`.

### AI in Privacy Policy

Add to privacy policy:

- [ ] AI assistant feature description
- [ ] Provider names (Groq, Mistral, Together AI)
- [ ] Data sent to each provider (messages, embeddings, images, audio)
- [ ] Provider's data retention policy
- [ ] How to opt out of AI features
- [ ] How to delete AI conversation history

### Provider Data Handling

We use multiple AI providers for different capabilities:

| Provider | Capability | Data Retention | Training | Region | DPA |
|----------|------------|----------------|----------|--------|-----|
| **Groq** | Chat, Audio | Not stored | No | US | [Available](https://groq.com/privacy-policy/) |
| **Mistral** | Embeddings | 30 days | Opt-out | EU (France) | [Available](https://mistral.ai/terms/) |
| **Together AI** | Images | Not stored | No | US | [Available](https://www.together.ai/privacy) |

**Privacy advantages:**
- **Groq & Together AI** do not retain or use API data for training
- **Mistral** is EU-based (GDPR-native), best for strict EU compliance
- All providers offer enterprise DPAs on request

**Note:** API usage has stricter data handling than consumer apps. Verify current policies for your use case.

---

## Third-Party Services

All services must be GDPR-compliant with DPAs. See [vendors.md](./vendors.md) for the complete vendor registry.

| Service | GDPR | DPA | EU Region |
|---------|------|-----|-----------|
| **Groq** | Yes | Available | No (US) |
| **Mistral** | Yes | Available | Yes (EU-native) |
| **Together AI** | Yes | Available | No (US) |
| **Vercel** | Yes | Available | Edge |
| **Neon** | Yes | Available | Yes |
| **Cloudflare R2** | Yes | Available | Yes |
| **Neo4j Aura** | Yes | Available | Yes |
| **Resend** | Yes | Available | No |
| **Sentry** | Yes | Available | Yes |
| **Inngest** | Yes | Available | Yes |

**New service checklist:**
- [ ] GDPR compliance page
- [ ] DPA available
- [ ] EU data residency (if required)
- [ ] Listed in privacy policy
- [ ] Added to [vendors.md](./vendors.md)

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

See [vendors.md](./vendors.md) for complete compliance matrix and alternatives.
