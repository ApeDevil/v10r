// Core shell
export { default as AppShell } from './AppShell.svelte';
export { default as Footer } from './Footer.svelte';

// Sidebar
export { default as Sidebar } from './Sidebar.svelte';
export { default as SidebarRail } from './SidebarRail.svelte';
export { default as SidebarDrawer } from './SidebarDrawer.svelte';
export { default as SidebarFab } from './SidebarFab.svelte';
export { default as SidebarLogo } from './SidebarLogo.svelte';
export { default as SidebarNav } from './SidebarNav.svelte';
export { default as SidebarTriggers } from './SidebarTriggers.svelte';

// Navigation
export { default as NavItem } from './NavItem.svelte';
export { default as NavAccordion } from './NavAccordion.svelte';
export { default as UserMenu } from './UserMenu.svelte';

// Toasts
export { ToastContainer } from '$lib/components/composites/toast';

// Utilities
export { default as NavigationProgress } from './NavigationProgress.svelte';
export { default as ShortcutsModal } from './ShortcutsModal.svelte';

// Notifications
export { default as SidebarNotifications } from './SidebarNotifications.svelte';

// Session lifecycle
export { default as SessionMonitor } from './session/SessionMonitor.svelte';
export { default as SessionWarningBanner } from './session/SessionWarningBanner.svelte';
export { default as SessionExpiryModal } from './session/SessionExpiryModal.svelte';
