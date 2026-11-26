/**
 * Feedback domain — pure business logic, no framework imports. Called from the /feedback
 * form action, /account/feedback, /admin/feedback and the privacy erasure.
 * Blueprint: docs/blueprint/feedback/request-driven-development.md.
 */
export * from './config';
export * from './erasure';
export * from './inbox';
export * from './lifecycle';
export * from './submission';
