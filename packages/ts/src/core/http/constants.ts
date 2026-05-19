export const REQUEST = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
} as const;

export const RETURN_TYPE = {
  JSON: 'JSON',
  TEXT: 'TEXT',
  BLOB: 'BLOB',
} as const;

/** Default timeout for fetch requests (5 seconds). */
export const DEFAULT_FETCH_TIMEOUT_MS = 5000;

export type RequestMethod = (typeof REQUEST)[keyof typeof REQUEST];
export type HttpReturnType = (typeof RETURN_TYPE)[keyof typeof RETURN_TYPE];
