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
export const MinRank = {
    Immediate: 'immediate',
    Graded: 'graded',
    Rop: 'rop',
    /** Synonym for {@link MinRank.Rop}. */
    ReturnOfPremium: 'rop',
    Guaranteed: 'guaranteed',
    /** Synonym for {@link MinRank.Guaranteed}. */
    GuaranteedIssue: 'guaranteed',
    /** Synonym for {@link MinRank.Guaranteed}. */
    Gi: 'guaranteed',
};
//# sourceMappingURL=minRank.js.map