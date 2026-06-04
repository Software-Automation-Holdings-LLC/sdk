/**
 * Minimum guaranteed-issue rank accepted by the server's `min_rank` filter on
 * prequalify and quote.
 *
 * The canonical identifiers are `Immediate`, `Graded`, `Rop`, and `Guaranteed`;
 * `ReturnOfPremium`, `GuaranteedIssue`, and `Gi` are synonyms that serialize to
 * the same lowercase wire token. The server compares case-insensitively and also
 * tolerates numeric strings, so {@link MinRankValue} is paired with an open
 * `string` escape hatch on the option types rather than narrowing the field.
 */
export declare const MinRank: {
    readonly Immediate: "immediate";
    readonly Graded: "graded";
    readonly Rop: "rop";
    /** Synonym for {@link MinRank.Rop}. */
    readonly ReturnOfPremium: "rop";
    readonly Guaranteed: "guaranteed";
    /** Synonym for {@link MinRank.Guaranteed}. */
    readonly GuaranteedIssue: "guaranteed";
    /** Synonym for {@link MinRank.Guaranteed}. */
    readonly Gi: "guaranteed";
};
/** The lowercase wire tokens the server accepts for `min_rank`. */
export type MinRankValue = (typeof MinRank)[keyof typeof MinRank];
//# sourceMappingURL=minRank.d.ts.map