# GDPR & Privacy

## What is it?

Data protection compliance framework for EU users. Implements consent management, user rights (access, export, erasure), and privacy-by-design principles.

## What is it for?

- Cookie consent management
- User data access and export
- Account deletion (right to erasure)
- AI data processing transparency
- Third-party vendor compliance

## Why was it chosen?

| Requirement | Implementation |
|-------------|----------------|
| Consent | Cookie banner, block non-essential until opt-in |
| Right to Access | `/account/data` page |
| Right to Export | JSON download endpoint |
| Right to Erasure | Account deletion flow |
| Data Minimization | Audit what's collected |

**Cookie categories:**
| Category | Examples | Consent Required |
|----------|----------|------------------|
| Necessary | Session, CSRF | No |
| Analytics | Vercel Analytics | Yes |
| Marketing | Ad pixels | Yes |

**Consent solutions:**
| Solution | Size | Cost |
|----------|------|------|
| Klaro | ~15 KB | Free (MIT) |
| DIY | ~2 KB | Free |
| Cookie Consent | ~30 KB | Free tier |

**Stack advantages:**
| Component | Benefit |
|-----------|---------|
| Better Auth | Self-hosted, full control |
| Drizzle | Easy export/deletion |
| Vercel Analytics | Cookieless default |
| Neon | EU region available |

## Known limitations

**Consent implementation:**
- Must block scripts until consent (not just show banner)
- Consent must be as easy to revoke as grant
- "Reject all" must be as prominent as "Accept all"
- Consent state must persist across sessions

**User rights:**
- Export must include ALL user data
- Deletion must cascade through all tables
- Backups must eventually purge deleted data
- 30-day response deadline

**AI data processing:**
- Requires separate consent for AI features
- Must disclose providers in privacy policy
- Cannot store AI conversations indefinitely
- User can request AI history deletion

**Third-party services:**
- All vendors need DPAs (Data Processing Agreements)
- US-based services need SCCs (Standard Contractual Clauses)
- Must maintain vendor registry
- Regular compliance audits

**Enforcement:**
| Violation | Maximum Fine |
|-----------|--------------|
| Minor (procedural) | 2% revenue or €10M |
| Major (rights) | 4% revenue or €20M |

**AI provider compliance:**
| Provider | Retention | Training | Region |
|----------|-----------|----------|--------|
| Groq | Not stored | No | US |
| Mistral | 30 days | Opt-out | EU |
| Together AI | Not stored | No | US |

## Related

- [../auth/better-auth.md](../auth/better-auth.md) - User data ownership
- [notifications.md](./notifications.md) - Marketing consent
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - AI data handling
