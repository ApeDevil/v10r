# Admin

Feature blueprints for admin-specific systems. See `docs/blueprint/admin-expansion.md` for the overall admin area architecture and page inventory.

## Files

| File | Main Topics |
|------|-------------|
| **[pairing.md](./pairing.md)** | Cross-device debug pairing — flow, schema (`pairing_codes`, `debug_owner_id`, `paired_admin_user_id`), 6-digit code design, HMAC cookie, hook chain position, cleanup sweeps, threat model, `PAIRING_SECRET` env var |
