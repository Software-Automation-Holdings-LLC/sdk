export declare const REQUEST: {
    readonly GET: "GET";
    readonly POST: "POST";
    readonly PUT: "PUT";
    readonly DELETE: "DELETE";
    readonly PATCH: "PATCH";
    readonly HEAD: "HEAD";
};
export declare const RETURN_TYPE: {
    readonly JSON: "JSON";
    readonly TEXT: "TEXT";
    readonly BLOB: "BLOB";
};
/** Default timeout for fetch requests (5 seconds). */
export declare const DEFAULT_FETCH_TIMEOUT_MS = 5000;
export type RequestMethod = (typeof REQUEST)[keyof typeof REQUEST];
export type HttpReturnType = (typeof RETURN_TYPE)[keyof typeof RETURN_TYPE];
//# sourceMappingURL=constants.d.ts.map