/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - ISO 3166-2:US (50 states + DC + 5 inhabited territories)
 */
/**
 * ISO 3166-2:US administrative subdivisions. Includes the 50 states, DC,
 * and the five inhabited US territories. Order is alphabetical by name.
 */
export declare enum State {
    Alabama = "AL",
    Alaska = "AK",
    AmericanSamoa = "AS",
    Arizona = "AZ",
    Arkansas = "AR",
    California = "CA",
    Colorado = "CO",
    Connecticut = "CT",
    Delaware = "DE",
    DistrictOfColumbia = "DC",
    Florida = "FL",
    Georgia = "GA",
    Guam = "GU",
    Hawaii = "HI",
    Idaho = "ID",
    Illinois = "IL",
    Indiana = "IN",
    Iowa = "IA",
    Kansas = "KS",
    Kentucky = "KY",
    Louisiana = "LA",
    Maine = "ME",
    Maryland = "MD",
    Massachusetts = "MA",
    Michigan = "MI",
    Minnesota = "MN",
    Mississippi = "MS",
    Missouri = "MO",
    Montana = "MT",
    Nebraska = "NE",
    Nevada = "NV",
    NewHampshire = "NH",
    NewJersey = "NJ",
    NewMexico = "NM",
    NewYork = "NY",
    NorthCarolina = "NC",
    NorthDakota = "ND",
    NorthernMarianaIslands = "MP",
    Ohio = "OH",
    Oklahoma = "OK",
    Oregon = "OR",
    Pennsylvania = "PA",
    PuertoRico = "PR",
    RhodeIsland = "RI",
    SouthCarolina = "SC",
    SouthDakota = "SD",
    Tennessee = "TN",
    Texas = "TX",
    UnitedStatesVirginIslands = "VI",
    Utah = "UT",
    Vermont = "VT",
    Virginia = "VA",
    Washington = "WA",
    WestVirginia = "WV",
    Wisconsin = "WI",
    Wyoming = "WY"
}
export interface StateMetadata {
    readonly abbreviation: string;
    readonly name: string;
    readonly isTerritory: boolean;
}
export declare const States: Readonly<{
    values(): readonly State[];
    entries(): ReadonlyArray<readonly [State, StateMetadata]>;
    metadata(s: State): StateMetadata;
    /**
     * Look up a state by its ISO abbreviation (case-insensitive) or by its
     * full English name (case-insensitive). Returns `undefined` for
     * unknown input.
     */
    byAbbreviation(abbr: string): State | undefined;
}>;
//# sourceMappingURL=states.d.ts.map