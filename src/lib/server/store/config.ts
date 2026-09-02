/**
 * Object-storage policy — upload size caps, presigned-URL lifetime, and the per-namespace
 * object budgets that bound R2 growth.
 */

/** Max S3 objects in showcase namespace */
export const MAX_SHOWCASE_OBJECTS = 20;

/** Max S3 objects in blog namespace */
export const MAX_BLOG_ASSETS = 100;

/** Max blog image upload size (bytes, 10 MB) */
export const MAX_BLOG_UPLOAD_SIZE = 10 * 1024 * 1024;

/** Max blog 3D model upload size (bytes, 50 MB) */
export const MAX_BLOG_3D_UPLOAD_SIZE = 50 * 1024 * 1024;

/** Max file upload size (bytes, 2 MB) */
export const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;

/** Presigned URL expiry (seconds) */
export const PRESIGNED_URL_EXPIRY = 300;
