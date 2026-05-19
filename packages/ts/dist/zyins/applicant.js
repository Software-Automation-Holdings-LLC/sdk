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
 * Applicant biological sex. Wire format uses single-letter codes; the
 * `WireCode` accessor performs that mapping so call sites never spell `"M"`
 * or `"F"` inline.
 */
export var Sex;
(function (Sex) {
    Sex["Male"] = "male";
    Sex["Female"] = "female";
})(Sex || (Sex = {}));
/** Single-letter wire code for the prequalify body. */
export function sexWireCode(sex) {
    return sex === Sex.Male ? 'M' : 'F';
}
/**
 * Nicotine usage. The wire format collapses this to a yes/no in legacy paths
 * and a tri-state in the modern path. Tier 3 callers state the underlying
 * fact (None / Current / Former); the prequalify builder maps to the wire
 * shape negotiated for the current API version.
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