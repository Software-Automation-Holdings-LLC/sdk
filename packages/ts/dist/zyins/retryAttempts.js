export const SDK_RETRY_ATTEMPTS_HEADER = 'x-isa-sdk-retry-attempts';
export function retryAttemptsFromHeaders(headers) {
    const raw = headers[SDK_RETRY_ATTEMPTS_HEADER];
    const attempts = raw === undefined ? 0 : Number(raw);
    return Number.isInteger(attempts) && attempts >= 0 ? attempts : 0;
}
//# sourceMappingURL=retryAttempts.js.map