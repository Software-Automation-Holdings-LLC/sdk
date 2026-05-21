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
export enum State {
  Alabama = 'AL',
  Alaska = 'AK',
  AmericanSamoa = 'AS',
  Arizona = 'AZ',
  Arkansas = 'AR',
  California = 'CA',
  Colorado = 'CO',
  Connecticut = 'CT',
  Delaware = 'DE',
  DistrictOfColumbia = 'DC',
  Florida = 'FL',
  Georgia = 'GA',
  Guam = 'GU',
  Hawaii = 'HI',
  Idaho = 'ID',
  Illinois = 'IL',
  Indiana = 'IN',
  Iowa = 'IA',
  Kansas = 'KS',
  Kentucky = 'KY',
  Louisiana = 'LA',
  Maine = 'ME',
  Maryland = 'MD',
  Massachusetts = 'MA',
  Michigan = 'MI',
  Minnesota = 'MN',
  Mississippi = 'MS',
  Missouri = 'MO',
  Montana = 'MT',
  Nebraska = 'NE',
  Nevada = 'NV',
  NewHampshire = 'NH',
  NewJersey = 'NJ',
  NewMexico = 'NM',
  NewYork = 'NY',
  NorthCarolina = 'NC',
  NorthDakota = 'ND',
  NorthernMarianaIslands = 'MP',
  Ohio = 'OH',
  Oklahoma = 'OK',
  Oregon = 'OR',
  Pennsylvania = 'PA',
  PuertoRico = 'PR',
  RhodeIsland = 'RI',
  SouthCarolina = 'SC',
  SouthDakota = 'SD',
  Tennessee = 'TN',
  Texas = 'TX',
  UnitedStatesVirginIslands = 'VI',
  Utah = 'UT',
  Vermont = 'VT',
  Virginia = 'VA',
  Washington = 'WA',
  WestVirginia = 'WV',
  Wisconsin = 'WI',
  Wyoming = 'WY',
}

export interface StateMetadata {
  readonly abbreviation: string;
  readonly name: string;
  readonly isTerritory: boolean;
}

const METADATA: Readonly<Record<string, StateMetadata>> = Object.freeze({
  'AL': { abbreviation: 'AL', name: "Alabama", isTerritory: false },
  'AK': { abbreviation: 'AK', name: "Alaska", isTerritory: false },
  'AS': { abbreviation: 'AS', name: "American Samoa", isTerritory: true },
  'AZ': { abbreviation: 'AZ', name: "Arizona", isTerritory: false },
  'AR': { abbreviation: 'AR', name: "Arkansas", isTerritory: false },
  'CA': { abbreviation: 'CA', name: "California", isTerritory: false },
  'CO': { abbreviation: 'CO', name: "Colorado", isTerritory: false },
  'CT': { abbreviation: 'CT', name: "Connecticut", isTerritory: false },
  'DE': { abbreviation: 'DE', name: "Delaware", isTerritory: false },
  'DC': { abbreviation: 'DC', name: "District of Columbia", isTerritory: false },
  'FL': { abbreviation: 'FL', name: "Florida", isTerritory: false },
  'GA': { abbreviation: 'GA', name: "Georgia", isTerritory: false },
  'GU': { abbreviation: 'GU', name: "Guam", isTerritory: true },
  'HI': { abbreviation: 'HI', name: "Hawaii", isTerritory: false },
  'ID': { abbreviation: 'ID', name: "Idaho", isTerritory: false },
  'IL': { abbreviation: 'IL', name: "Illinois", isTerritory: false },
  'IN': { abbreviation: 'IN', name: "Indiana", isTerritory: false },
  'IA': { abbreviation: 'IA', name: "Iowa", isTerritory: false },
  'KS': { abbreviation: 'KS', name: "Kansas", isTerritory: false },
  'KY': { abbreviation: 'KY', name: "Kentucky", isTerritory: false },
  'LA': { abbreviation: 'LA', name: "Louisiana", isTerritory: false },
  'ME': { abbreviation: 'ME', name: "Maine", isTerritory: false },
  'MD': { abbreviation: 'MD', name: "Maryland", isTerritory: false },
  'MA': { abbreviation: 'MA', name: "Massachusetts", isTerritory: false },
  'MI': { abbreviation: 'MI', name: "Michigan", isTerritory: false },
  'MN': { abbreviation: 'MN', name: "Minnesota", isTerritory: false },
  'MS': { abbreviation: 'MS', name: "Mississippi", isTerritory: false },
  'MO': { abbreviation: 'MO', name: "Missouri", isTerritory: false },
  'MT': { abbreviation: 'MT', name: "Montana", isTerritory: false },
  'NE': { abbreviation: 'NE', name: "Nebraska", isTerritory: false },
  'NV': { abbreviation: 'NV', name: "Nevada", isTerritory: false },
  'NH': { abbreviation: 'NH', name: "New Hampshire", isTerritory: false },
  'NJ': { abbreviation: 'NJ', name: "New Jersey", isTerritory: false },
  'NM': { abbreviation: 'NM', name: "New Mexico", isTerritory: false },
  'NY': { abbreviation: 'NY', name: "New York", isTerritory: false },
  'NC': { abbreviation: 'NC', name: "North Carolina", isTerritory: false },
  'ND': { abbreviation: 'ND', name: "North Dakota", isTerritory: false },
  'MP': { abbreviation: 'MP', name: "Northern Mariana Islands", isTerritory: true },
  'OH': { abbreviation: 'OH', name: "Ohio", isTerritory: false },
  'OK': { abbreviation: 'OK', name: "Oklahoma", isTerritory: false },
  'OR': { abbreviation: 'OR', name: "Oregon", isTerritory: false },
  'PA': { abbreviation: 'PA', name: "Pennsylvania", isTerritory: false },
  'PR': { abbreviation: 'PR', name: "Puerto Rico", isTerritory: true },
  'RI': { abbreviation: 'RI', name: "Rhode Island", isTerritory: false },
  'SC': { abbreviation: 'SC', name: "South Carolina", isTerritory: false },
  'SD': { abbreviation: 'SD', name: "South Dakota", isTerritory: false },
  'TN': { abbreviation: 'TN', name: "Tennessee", isTerritory: false },
  'TX': { abbreviation: 'TX', name: "Texas", isTerritory: false },
  'VI': { abbreviation: 'VI', name: "United States Virgin Islands", isTerritory: true },
  'UT': { abbreviation: 'UT', name: "Utah", isTerritory: false },
  'VT': { abbreviation: 'VT', name: "Vermont", isTerritory: false },
  'VA': { abbreviation: 'VA', name: "Virginia", isTerritory: false },
  'WA': { abbreviation: 'WA', name: "Washington", isTerritory: false },
  'WV': { abbreviation: 'WV', name: "West Virginia", isTerritory: false },
  'WI': { abbreviation: 'WI', name: "Wisconsin", isTerritory: false },
  'WY': { abbreviation: 'WY', name: "Wyoming", isTerritory: false },
});

const BY_NAME: Readonly<Record<string, string>> = Object.freeze({
  "alabama": 'AL',
  "alaska": 'AK',
  "american samoa": 'AS',
  "arizona": 'AZ',
  "arkansas": 'AR',
  "california": 'CA',
  "colorado": 'CO',
  "connecticut": 'CT',
  "delaware": 'DE',
  "district of columbia": 'DC',
  "florida": 'FL',
  "georgia": 'GA',
  "guam": 'GU',
  "hawaii": 'HI',
  "idaho": 'ID',
  "illinois": 'IL',
  "indiana": 'IN',
  "iowa": 'IA',
  "kansas": 'KS',
  "kentucky": 'KY',
  "louisiana": 'LA',
  "maine": 'ME',
  "maryland": 'MD',
  "massachusetts": 'MA',
  "michigan": 'MI',
  "minnesota": 'MN',
  "mississippi": 'MS',
  "missouri": 'MO',
  "montana": 'MT',
  "nebraska": 'NE',
  "nevada": 'NV',
  "new hampshire": 'NH',
  "new jersey": 'NJ',
  "new mexico": 'NM',
  "new york": 'NY',
  "north carolina": 'NC',
  "north dakota": 'ND',
  "northern mariana islands": 'MP',
  "ohio": 'OH',
  "oklahoma": 'OK',
  "oregon": 'OR',
  "pennsylvania": 'PA',
  "puerto rico": 'PR',
  "rhode island": 'RI',
  "south carolina": 'SC',
  "south dakota": 'SD',
  "tennessee": 'TN',
  "texas": 'TX',
  "united states virgin islands": 'VI',
  "utah": 'UT',
  "vermont": 'VT',
  "virginia": 'VA',
  "washington": 'WA',
  "west virginia": 'WV',
  "wisconsin": 'WI',
  "wyoming": 'WY',
});

const ALL_STATES: readonly State[] = Object.freeze(Object.values(State) as State[]);

export const States = Object.freeze({
  values(): readonly State[] {
    return ALL_STATES;
  },
  entries(): ReadonlyArray<readonly [State, StateMetadata]> {
    return ALL_STATES.map((s) => [s, METADATA[s]!] as const);
  },
  metadata(s: State): StateMetadata {
    const m = METADATA[s];
    if (!m) throw new Error(`States.metadata: unknown state '${s}'`);
    return m;
  },
  /**
   * Look up a state by its ISO abbreviation (case-insensitive) or by its
   * full English name (case-insensitive). Returns `undefined` for
   * unknown input.
   */
  byAbbreviation(abbr: string): State | undefined {
    const upper = abbr.toUpperCase();
    if (upper in METADATA) return upper as State;
    const fromName = BY_NAME[abbr.toLowerCase()];
    return fromName ? (fromName as State) : undefined;
  },
});
