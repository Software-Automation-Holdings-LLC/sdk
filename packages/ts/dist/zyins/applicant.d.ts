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
export declare enum Sex {
    Male = "male",
    Female = "female"
}
/** Single-letter wire code for the prequalify body. */
export declare function sexWireCode(sex: Sex): 'M' | 'F';
/**
 * Nicotine usage. The wire format collapses this to a yes/no in legacy paths
 * and a tri-state in the modern path. Tier 3 callers state the underlying
 * fact (None / Current / Former); the prequalify builder maps to the wire
 * shape negotiated for the current API version.
 */
export declare enum NicotineUsage {
    None = "none",
    Current = "current",
    Former = "former"
}
/**
 * Total height for the applicant. Constructed via `Height.fromFeetInches`
 * so the call site never multiplies by 12 inline. Internally stored as a
 * total inch count to match the engine's normalized form.
 */
export declare class Height {
    readonly totalInches: number;
    private constructor();
    /** Construct a height from a feet+inches pair (the natural US input). */
    static fromFeetInches(feet: number, inches: number): Height;
    /** Construct a height from a total inch count (rare; for parity tests). */
    static fromInches(totalInches: number): Height;
}
/**
 * Applicant weight in pounds (the only unit the prequalify wire accepts).
 * The factory exists so the call site reads `Weight.fromPounds(195)` rather
 * than passing a bare number which loses unit context.
 */
export declare class Weight {
    readonly pounds: number;
    private constructor();
    /** Construct from a pound value (the natural US input). */
    static fromPounds(pounds: number): Weight;
}
/** A single medication on the applicant profile. */
export interface Medication {
    /** Drug name as the applicant reports it (e.g., "LOSARTAN"). */
    name: string;
    /** Reason for use (e.g., "HIGH BLOOD PRESSURE"). */
    use: string;
    /** Relative date string the prequalify engine accepts (e.g., "11 MONTHS AGO"). */
    firstFill: string;
    /** Most recent fill date in the same relative format. */
    lastFill: string;
}
/** A single medical condition on the applicant profile. */
export interface Condition {
    /** Condition name as the applicant reports it (e.g., "COPD", "HBP"). */
    name: string;
    /** Relative date string of diagnosis (e.g., "3 DAYS AGO"). */
    wasDiagnosed: string;
    /** Relative date string of most recent treatment. */
    lastTreatment: string;
}
/**
 * The applicant profile prequalify operates on. All fields are required for
 * a useful prequalify; the engine will refuse a request that omits any of
 * them, so they are non-optional at the type level.
 */
export interface Applicant {
    /** Date of birth as an ISO 8601 date string (e.g., "1962-04-18"). */
    dob: string;
    sex: Sex;
    height: Height;
    weight: Weight;
    /** US state of residence (two-letter postal code, e.g., "NC"). */
    state: string;
    /** ZIP code; required by some product families. */
    zip?: string;
    nicotineUse: NicotineUsage;
    /** Optional medications list; defaults to none. */
    medications?: ReadonlyArray<Medication>;
    /** Optional conditions list; defaults to none. */
    conditions?: ReadonlyArray<Condition>;
}
//# sourceMappingURL=applicant.d.ts.map