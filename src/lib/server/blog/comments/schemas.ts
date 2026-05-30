/**
 * Server-side re-export of comment schemas. The canonical definitions live
 * at $lib/schemas/blog/comments so the client (CommentsIsland) can import
 * them without dragging server-only code into the bundle.
 */
export * from '$lib/schemas/blog/comments';
