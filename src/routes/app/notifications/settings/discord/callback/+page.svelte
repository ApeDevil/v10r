<script lang="ts">
// This page only exists to handle the OAuth callback redirect.
// The +page.server.ts load function processes the callback and redirects.
import * as m from '$lib/paraglide/messages';
</script>

<p>{m.app_notifications_discord_connecting()}</p>
