"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - ISO 3166-2:US (50 states + DC + 5 inhabited territories)
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class State(str, Enum):
    """ISO 3166-2:US administrative subdivisions.

    Includes the 50 states, DC, and the five inhabited US territories.
    Order is alphabetical by name.
    """

    Alabama = 'AL'
    Alaska = 'AK'
    Arizona = 'AZ'
    Arkansas = 'AR'
    California = 'CA'
    Colorado = 'CO'
    Connecticut = 'CT'
    Delaware = 'DE'
    Florida = 'FL'
    Georgia = 'GA'
    Hawaii = 'HI'
    Idaho = 'ID'
    Illinois = 'IL'
    Indiana = 'IN'
    Iowa = 'IA'
    Kansas = 'KS'
    Kentucky = 'KY'
    Louisiana = 'LA'
    Maine = 'ME'
    Maryland = 'MD'
    Massachusetts = 'MA'
    Michigan = 'MI'
    Minnesota = 'MN'
    Mississippi = 'MS'
    Missouri = 'MO'
    Montana = 'MT'
    Nebraska = 'NE'
    Nevada = 'NV'
    NewHampshire = 'NH'
    NewJersey = 'NJ'
    NewMexico = 'NM'
    NewYork = 'NY'
    NorthCarolina = 'NC'
    NorthDakota = 'ND'
    Ohio = 'OH'
    Oklahoma = 'OK'
    Oregon = 'OR'
    Pennsylvania = 'PA'
    RhodeIsland = 'RI'
    SouthCarolina = 'SC'
    SouthDakota = 'SD'
    Tennessee = 'TN'
    Texas = 'TX'
    Utah = 'UT'
    Vermont = 'VT'
    Virginia = 'VA'
    Washington = 'WA'
    WestVirginia = 'WV'
    Wisconsin = 'WI'
    Wyoming = 'WY'
    DistrictOfColumbia = 'DC'
    AmericanSamoa = 'AS'
    Guam = 'GU'
    NorthernMarianaIslands = 'MP'
    PuertoRico = 'PR'
    UnitedStatesVirginIslands = 'VI'


@dataclass(frozen=True, slots=True)
class StateMetadata:
    abbreviation: str
    name: str
    is_territory: bool


_METADATA: dict[str, StateMetadata] = {
    'AL': StateMetadata(abbreviation='AL', name='Alabama', is_territory=False),
    'AK': StateMetadata(abbreviation='AK', name='Alaska', is_territory=False),
    'AZ': StateMetadata(abbreviation='AZ', name='Arizona', is_territory=False),
    'AR': StateMetadata(abbreviation='AR', name='Arkansas', is_territory=False),
    'CA': StateMetadata(abbreviation='CA', name='California', is_territory=False),
    'CO': StateMetadata(abbreviation='CO', name='Colorado', is_territory=False),
    'CT': StateMetadata(abbreviation='CT', name='Connecticut', is_territory=False),
    'DE': StateMetadata(abbreviation='DE', name='Delaware', is_territory=False),
    'FL': StateMetadata(abbreviation='FL', name='Florida', is_territory=False),
    'GA': StateMetadata(abbreviation='GA', name='Georgia', is_territory=False),
    'HI': StateMetadata(abbreviation='HI', name='Hawaii', is_territory=False),
    'ID': StateMetadata(abbreviation='ID', name='Idaho', is_territory=False),
    'IL': StateMetadata(abbreviation='IL', name='Illinois', is_territory=False),
    'IN': StateMetadata(abbreviation='IN', name='Indiana', is_territory=False),
    'IA': StateMetadata(abbreviation='IA', name='Iowa', is_territory=False),
    'KS': StateMetadata(abbreviation='KS', name='Kansas', is_territory=False),
    'KY': StateMetadata(abbreviation='KY', name='Kentucky', is_territory=False),
    'LA': StateMetadata(abbreviation='LA', name='Louisiana', is_territory=False),
    'ME': StateMetadata(abbreviation='ME', name='Maine', is_territory=False),
    'MD': StateMetadata(abbreviation='MD', name='Maryland', is_territory=False),
    'MA': StateMetadata(abbreviation='MA', name='Massachusetts', is_territory=False),
    'MI': StateMetadata(abbreviation='MI', name='Michigan', is_territory=False),
    'MN': StateMetadata(abbreviation='MN', name='Minnesota', is_territory=False),
    'MS': StateMetadata(abbreviation='MS', name='Mississippi', is_territory=False),
    'MO': StateMetadata(abbreviation='MO', name='Missouri', is_territory=False),
    'MT': StateMetadata(abbreviation='MT', name='Montana', is_territory=False),
    'NE': StateMetadata(abbreviation='NE', name='Nebraska', is_territory=False),
    'NV': StateMetadata(abbreviation='NV', name='Nevada', is_territory=False),
    'NH': StateMetadata(abbreviation='NH', name='New Hampshire', is_territory=False),
    'NJ': StateMetadata(abbreviation='NJ', name='New Jersey', is_territory=False),
    'NM': StateMetadata(abbreviation='NM', name='New Mexico', is_territory=False),
    'NY': StateMetadata(abbreviation='NY', name='New York', is_territory=False),
    'NC': StateMetadata(abbreviation='NC', name='North Carolina', is_territory=False),
    'ND': StateMetadata(abbreviation='ND', name='North Dakota', is_territory=False),
    'OH': StateMetadata(abbreviation='OH', name='Ohio', is_territory=False),
    'OK': StateMetadata(abbreviation='OK', name='Oklahoma', is_territory=False),
    'OR': StateMetadata(abbreviation='OR', name='Oregon', is_territory=False),
    'PA': StateMetadata(abbreviation='PA', name='Pennsylvania', is_territory=False),
    'RI': StateMetadata(abbreviation='RI', name='Rhode Island', is_territory=False),
    'SC': StateMetadata(abbreviation='SC', name='South Carolina', is_territory=False),
    'SD': StateMetadata(abbreviation='SD', name='South Dakota', is_territory=False),
    'TN': StateMetadata(abbreviation='TN', name='Tennessee', is_territory=False),
    'TX': StateMetadata(abbreviation='TX', name='Texas', is_territory=False),
    'UT': StateMetadata(abbreviation='UT', name='Utah', is_territory=False),
    'VT': StateMetadata(abbreviation='VT', name='Vermont', is_territory=False),
    'VA': StateMetadata(abbreviation='VA', name='Virginia', is_territory=False),
    'WA': StateMetadata(abbreviation='WA', name='Washington', is_territory=False),
    'WV': StateMetadata(abbreviation='WV', name='West Virginia', is_territory=False),
    'WI': StateMetadata(abbreviation='WI', name='Wisconsin', is_territory=False),
    'WY': StateMetadata(abbreviation='WY', name='Wyoming', is_territory=False),
    'DC': StateMetadata(abbreviation='DC', name='District of Columbia', is_territory=False),
    'AS': StateMetadata(abbreviation='AS', name='American Samoa', is_territory=True),
    'GU': StateMetadata(abbreviation='GU', name='Guam', is_territory=True),
    'MP': StateMetadata(abbreviation='MP', name='Northern Mariana Islands', is_territory=True),
    'PR': StateMetadata(abbreviation='PR', name='Puerto Rico', is_territory=True),
    'VI': StateMetadata(abbreviation='VI', name='United States Virgin Islands', is_territory=True),
}

_BY_NAME: dict[str, str] = {
    'alabama': 'AL',
    'alaska': 'AK',
    'arizona': 'AZ',
    'arkansas': 'AR',
    'california': 'CA',
    'colorado': 'CO',
    'connecticut': 'CT',
    'delaware': 'DE',
    'florida': 'FL',
    'georgia': 'GA',
    'hawaii': 'HI',
    'idaho': 'ID',
    'illinois': 'IL',
    'indiana': 'IN',
    'iowa': 'IA',
    'kansas': 'KS',
    'kentucky': 'KY',
    'louisiana': 'LA',
    'maine': 'ME',
    'maryland': 'MD',
    'massachusetts': 'MA',
    'michigan': 'MI',
    'minnesota': 'MN',
    'mississippi': 'MS',
    'missouri': 'MO',
    'montana': 'MT',
    'nebraska': 'NE',
    'nevada': 'NV',
    'new hampshire': 'NH',
    'new jersey': 'NJ',
    'new mexico': 'NM',
    'new york': 'NY',
    'north carolina': 'NC',
    'north dakota': 'ND',
    'ohio': 'OH',
    'oklahoma': 'OK',
    'oregon': 'OR',
    'pennsylvania': 'PA',
    'rhode island': 'RI',
    'south carolina': 'SC',
    'south dakota': 'SD',
    'tennessee': 'TN',
    'texas': 'TX',
    'utah': 'UT',
    'vermont': 'VT',
    'virginia': 'VA',
    'washington': 'WA',
    'west virginia': 'WV',
    'wisconsin': 'WI',
    'wyoming': 'WY',
    'district of columbia': 'DC',
    'american samoa': 'AS',
    'guam': 'GU',
    'northern mariana islands': 'MP',
    'puerto rico': 'PR',
    'united states virgin islands': 'VI',
}

_ALL_STATES: tuple[State, ...] = tuple(State)


class _StatesAPI:
    __slots__ = ()

    def values(self) -> tuple[State, ...]:
        return _ALL_STATES

    def entries(self) -> tuple[tuple[State, StateMetadata], ...]:
        return tuple((s, _METADATA[s.value]) for s in _ALL_STATES)

    def metadata(self, s: State) -> StateMetadata:
        m = _METADATA.get(s.value)
        if m is None:
            raise KeyError(f"States.metadata: unknown state {s!r}")
        return m

    def by_abbreviation(self, abbr: str) -> State | None:
        """Look up a state by ISO abbreviation or full English name.

        Both forms are case-insensitive. Returns ``None`` for unknown input.
        """
        if not isinstance(abbr, str) or not abbr:
            return None
        upper = abbr.upper()
        if upper in _METADATA:
            return State(upper)
        from_name = _BY_NAME.get(abbr.lower())
        return State(from_name) if from_name else None


States = _StatesAPI()
