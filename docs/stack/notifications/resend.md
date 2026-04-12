# Email Notifications (Resend)

## What is it?

Transactional email API with excellent developer experience. Sends emails via REST API or SMTP.

## What is it for?

- Password resets, email verification
- Order confirmations, receipts
- Notification emails (mentions, comments)
- Marketing emails (newsletters, promotions)

## Why Resend?

| Provider | Free Tier | DX | Deliverability |
|----------|-----------|----|--------------  |
| **Resend** | 100/day (3K/mo) | Excellent | Good |
| SendGrid | 100/day | Complex | Excellent |
| Postmark | 100/mo | Good | Best |
| AWS SES | 62K/mo (from EC2) | Low-level | Good |

**Resend advantages:**
- Simple REST API, great TypeScript SDK
- React Email for JSX templates
- Good deliverability out of the box
- Generous free tier for development

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
| `RESEND_FROM_EMAIL` | Sender address |
| `RESEND_REPLY_TO` | Reply-to address |

## Email Templates

| Approach | When to use |
|----------|-------------|
| **React Email** | Reusable components, complex layouts |
| **Plain HTML** | Simple emails, minimal dependencies |

React Email allows JSX-based templates with component reuse and inline styles.

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
| No built-in templates | Use React Email |
| No email scheduling | Use background job (Inngest) |
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
