/**
 * Tier 3 applicant types for ZyINS prequalify.
 *
 * The wire format speaks in flat strings (sex code, integer inches, integer
 * pounds, ISO date) but Tier 3 callers speak in domain values (a `Sex` enum,
 * a `Height` constructed from feet+inches, a `Weight` constructed from
 * pounds). The factories in this module hide the bucket math; the client's
 * prequalify builder is the only consumer that knows how to serialize them.
 */
/**
 * Applicant biological sex. The server accepts `male` and `female`
 * (canonical lowercase per ADR-012) and normalises legacy single-letter codes
 * (`M`, `F`) transparently. The SDK emits only the canonical form.
 */
export var Sex;
(function (Sex) {
    Sex["Male"] = "male";
    Sex["Female"] = "female";
})(Sex || (Sex = {}));
/**
 * How long ago the applicant last used any nicotine product.
 * Values mirror the server's `NicotineLastUsed` enum exactly; the SDK
 * re-exports them under a friendlier name so callers never spell raw strings.
 */
export var NicotineDuration;
(function (NicotineDuration) {
    NicotineDuration["Never"] = "never";
    NicotineDuration["Within12Months"] = "within_12_months";
    NicotineDuration["N12To24Months"] = "12_to_24_months";
    NicotineDuration["N24To36Months"] = "24_to_36_months";
    NicotineDuration["N36To48Months"] = "36_to_48_months";
    NicotineDuration["N48To60Months"] = "48_to_60_months";
    NicotineDuration["Over60Months"] = "over_60_months";
})(NicotineDuration || (NicotineDuration = {}));
/**
 * @deprecated Use {@link NicotineUsageInput} with {@link NicotineDuration}.
 *
 * The old three-state enum (`None / Current / Former`) did not capture the
 * duration granularity the server requires. Existing callers can migrate by
 * replacing:
 *   - `NicotineUsage.None` → `{ lastUsed: NicotineDuration.Never }`
 *   - `NicotineUsage.Current` → `{ lastUsed: NicotineDuration.Within12Months }`
 *   - `NicotineUsage.Former` → `{ lastUsed: NicotineDuration.N12To24Months }`
 *     (or the appropriate duration bucket)
 */
export var NicotineUsage;
(function (NicotineUsage) {
    NicotineUsage["None"] = "none";
    NicotineUsage["Current"] = "current";
    NicotineUsage["Former"] = "former";
})(NicotineUsage || (NicotineUsage = {}));
/**
 * Total height for the applicant. Constructed via `Height.fromFeetInches`
 * so the call site never multiplies by 12 inline. Internally stored as a
 * total inch count to match the engine's normalized form.
 */
export class Height {
    totalInches;
    constructor(totalInches) {
        this.totalInches = totalInches;
    }
    /** Construct a height from a feet+inches pair (the natural US input). */
    static fromFeetInches(feet, inches) {
        if (!Number.isFinite(feet) || !Number.isFinite(inches)) {
            throw new Error('Height.fromFeetInches: feet and inches must be finite numbers');
        }
        if (feet < 0 || inches < 0) {
            throw new Error('Height.fromFeetInches: feet and inches must be non-negative');
        }
        return new Height(Math.round(feet * INCHES_PER_FOOT + inches));
    }
    /** Construct a height from a total inch count (rare; for parity tests). */
    static fromInches(totalInches) {
        if (!Number.isFinite(totalInches) || totalInches < 0) {
            throw new Error('Height.fromInches: totalInches must be a non-negative number');
        }
        return new Height(Math.round(totalInches));
    }
}
const INCHES_PER_FOOT = 12;
/**
 * Applicant weight in pounds (the only unit the prequalify wire accepts).
 * The factory exists so the call site reads `Weight.fromPounds(195)` rather
 * than passing a bare number which loses unit context.
 */
export class Weight {
    pounds;
    constructor(pounds) {
        this.pounds = pounds;
    }
    /** Construct from a pound value (the natural US input). */
    static fromPounds(pounds) {
        if (!Number.isFinite(pounds) || pounds <= 0) {
            throw new Error('Weight.fromPounds: pounds must be a positive number');
        }
        return new Weight(Math.round(pounds));
    }
}
//# sourceMappingURL=applicant.js.map