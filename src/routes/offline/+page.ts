// Prerendered so the service worker can precache it as the offline fallback.
// Lives outside the [[locale=locale]] tree: the page must be self-contained
// (no session/announcement loads, no AppShell) — it renders when nothing else can.
export const prerender = true;
