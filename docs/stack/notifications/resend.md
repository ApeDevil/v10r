# Email Notifications (Resend)

Transactional email via the Resend REST API. The provider (`providers/email.ts`) calls `https://api.resend.com/emails` with a raw `fetch()` and builds an inline-styled HTML string in `buildHtml()` — no `resend` SDK, no React Email.

## Why was it chosen?

- Simple REST API and a generous free tier for development.

See [../vendors.md](../vendors.md#resend) for pricing details.

## Setup Requirements

### DNS Configuration

Required DNS records for deliverability:

| Record | Type | Purpose |
|--------|------|---------|
| SPF | TXT | Authorize Resend to send |
| DKIM | CNAME (3 records) | Email signature verification |
| DMARC | TXT | Policy for failed checks |

Resend dashboard provides exact records after domain verification.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | API authentication |
| `RESEND_FROM_EMAIL` | Sender address (falls back to `notifications@example.com` when unset) |

The send body sets no `reply_to` field; there is no reply-to env var.

## Email Templates

The implemented path builds an inline-styled HTML string in `buildHtml()` (`providers/email.ts`) and posts it to the Resend API. There is no template engine.

React Email (JSX templates with component reuse) is an option if richer templating is ever needed, but it is not a dependency today.

## Deliverability Best Practices

| Practice | Why |
|----------|-----|
| Verify domain (SPF, DKIM, DMARC) | Prevents spam flagging |
| Use consistent "from" address | Builds sender reputation |
| Include unsubscribe link | Required by law, reduces spam reports |
| Avoid spam trigger words | "FREE!!!", excessive caps |
| Send from subdomain | Protects main domain reputation |
| Handle bounces | Remove invalid addresses |

## Known Limitations

| Limitation | Workaround |
|------------|------------|
| 100 emails/day on free tier | Upgrade for production |
| No built-in templates | Inline HTML string (`buildHtml()`) |
| No email scheduling | Use the in-process delivery worker |
| Limited analytics | Use Resend dashboard or upgrade |

## Rate Limits

| Plan | Limit |
|------|-------|
| Free | 100/day, 3K/month |
| Pro ($20/mo) | 50K/month |

For burst sending (marketing campaigns), use background jobs with rate limiting.

## Related

- [README.md](./README.md) - Notification architecture
- [../vendors.md](../vendors.md#resend) - Pricing, alternatives
- [../capabilities/gdpr.md](../capabilities/gdpr.md) - Email consent requirements
