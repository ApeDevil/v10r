# Admin

Feature blueprints for admin-specific systems. The overall admin area architecture and page inventory (vertical sidebar, canonical data-table pattern, guard pattern; pages include `/admin/access/authors`, `/admin/access/requests`, `/admin/content/comments`) is reflected directly in the implemented routes under `src/routes/[[locale=locale]]/admin/`.

## Files

| File | Main Topics |
|------|-------------|
| **[pairing.md](./pairing.md)** | Cross-device debug pairing — flow, schema (`pairing_codes`, `debug_owner_id`, `paired_admin_user_id`), 6-digit code design, HMAC cookie, hook chain position, cleanup sweeps, threat model, `PAIRING_SECRET` env var |
