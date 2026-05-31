// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - ISO 3166-2:US (50 states + DC + 5 inhabited territories)

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Reflection;

namespace Isa.Sdk.Catalog;

/// <summary>Attaches the canonical wire-form string to a catalog enum member.</summary>
[AttributeUsage(AttributeTargets.Field)]
public sealed class WireValueAttribute : Attribute
{
    /// <summary>Canonical wire-form value emitted by the engine.</summary>
    public string Value { get; }
    /// <summary>Construct with the canonical wire value.</summary>
    public WireValueAttribute(string value) => Value = value;
}

/// <summary>ISO 3166-2:US administrative subdivisions. Includes the 50 states,
/// DC, and the five inhabited US territories. Order is alphabetical by name.</summary>
public enum State
{
    /// <summary>Alabama (AL).</summary>
    [WireValue("AL")] Alabama,
    /// <summary>Alaska (AK).</summary>
    [WireValue("AK")] Alaska,
    /// <summary>Arizona (AZ).</summary>
    [WireValue("AZ")] Arizona,
    /// <summary>Arkansas (AR).</summary>
    [WireValue("AR")] Arkansas,
    /// <summary>California (CA).</summary>
    [WireValue("CA")] California,
    /// <summary>Colorado (CO).</summary>
    [WireValue("CO")] Colorado,
    /// <summary>Connecticut (CT).</summary>
    [WireValue("CT")] Connecticut,
    /// <summary>Delaware (DE).</summary>
    [WireValue("DE")] Delaware,
    /// <summary>Florida (FL).</summary>
    [WireValue("FL")] Florida,
    /// <summary>Georgia (GA).</summary>
    [WireValue("GA")] Georgia,
    /// <summary>Hawaii (HI).</summary>
    [WireValue("HI")] Hawaii,
    /// <summary>Idaho (ID).</summary>
    [WireValue("ID")] Idaho,
    /// <summary>Illinois (IL).</summary>
    [WireValue("IL")] Illinois,
    /// <summary>Indiana (IN).</summary>
    [WireValue("IN")] Indiana,
    /// <summary>Iowa (IA).</summary>
    [WireValue("IA")] Iowa,
    /// <summary>Kansas (KS).</summary>
    [WireValue("KS")] Kansas,
    /// <summary>Kentucky (KY).</summary>
    [WireValue("KY")] Kentucky,
    /// <summary>Louisiana (LA).</summary>
    [WireValue("LA")] Louisiana,
    /// <summary>Maine (ME).</summary>
    [WireValue("ME")] Maine,
    /// <summary>Maryland (MD).</summary>
    [WireValue("MD")] Maryland,
    /// <summary>Massachusetts (MA).</summary>
    [WireValue("MA")] Massachusetts,
    /// <summary>Michigan (MI).</summary>
    [WireValue("MI")] Michigan,
    /// <summary>Minnesota (MN).</summary>
    [WireValue("MN")] Minnesota,
    /// <summary>Mississippi (MS).</summary>
    [WireValue("MS")] Mississippi,
    /// <summary>Missouri (MO).</summary>
    [WireValue("MO")] Missouri,
    /// <summary>Montana (MT).</summary>
    [WireValue("MT")] Montana,
    /// <summary>Nebraska (NE).</summary>
    [WireValue("NE")] Nebraska,
    /// <summary>Nevada (NV).</summary>
    [WireValue("NV")] Nevada,
    /// <summary>New Hampshire (NH).</summary>
    [WireValue("NH")] NewHampshire,
    /// <summary>New Jersey (NJ).</summary>
    [WireValue("NJ")] NewJersey,
    /// <summary>New Mexico (NM).</summary>
    [WireValue("NM")] NewMexico,
    /// <summary>New York (NY).</summary>
    [WireValue("NY")] NewYork,
    /// <summary>North Carolina (NC).</summary>
    [WireValue("NC")] NorthCarolina,
    /// <summary>North Dakota (ND).</summary>
    [WireValue("ND")] NorthDakota,
    /// <summary>Ohio (OH).</summary>
    [WireValue("OH")] Ohio,
    /// <summary>Oklahoma (OK).</summary>
    [WireValue("OK")] Oklahoma,
    /// <summary>Oregon (OR).</summary>
    [WireValue("OR")] Oregon,
    /// <summary>Pennsylvania (PA).</summary>
    [WireValue("PA")] Pennsylvania,
    /// <summary>Rhode Island (RI).</summary>
    [WireValue("RI")] RhodeIsland,
    /// <summary>South Carolina (SC).</summary>
    [WireValue("SC")] SouthCarolina,
    /// <summary>South Dakota (SD).</summary>
    [WireValue("SD")] SouthDakota,
    /// <summary>Tennessee (TN).</summary>
    [WireValue("TN")] Tennessee,
    /// <summary>Texas (TX).</summary>
    [WireValue("TX")] Texas,
    /// <summary>Utah (UT).</summary>
    [WireValue("UT")] Utah,
    /// <summary>Vermont (VT).</summary>
    [WireValue("VT")] Vermont,
    /// <summary>Virginia (VA).</summary>
    [WireValue("VA")] Virginia,
    /// <summary>Washington (WA).</summary>
    [WireValue("WA")] Washington,
    /// <summary>West Virginia (WV).</summary>
    [WireValue("WV")] WestVirginia,
    /// <summary>Wisconsin (WI).</summary>
    [WireValue("WI")] Wisconsin,
    /// <summary>Wyoming (WY).</summary>
    [WireValue("WY")] Wyoming,
    /// <summary>District of Columbia (DC).</summary>
    [WireValue("DC")] DistrictOfColumbia,
    /// <summary>American Samoa (AS).</summary>
    [WireValue("AS")] AmericanSamoa,
    /// <summary>Guam (GU).</summary>
    [WireValue("GU")] Guam,
    /// <summary>Northern Mariana Islands (MP).</summary>
    [WireValue("MP")] NorthernMarianaIslands,
    /// <summary>Puerto Rico (PR).</summary>
    [WireValue("PR")] PuertoRico,
    /// <summary>United States Virgin Islands (VI).</summary>
    [WireValue("VI")] UnitedStatesVirginIslands,
}

/// <summary>Public metadata for a single <see cref="State"/>.</summary>
public sealed record StateMetadata(string Abbreviation, string Name, bool IsTerritory);

/// <summary>Catalog API for <see cref="State"/>. Every accessor returns a
/// read-only view; the underlying tables are constructed once at startup.</summary>
public static class States
{
    private static readonly IReadOnlyDictionary<string, StateMetadata> METADATA = new ReadOnlyDictionary<string, StateMetadata>(new Dictionary<string, StateMetadata>
    {
        ["AL"] = new StateMetadata("AL", "Alabama", false),
        ["AK"] = new StateMetadata("AK", "Alaska", false),
        ["AZ"] = new StateMetadata("AZ", "Arizona", false),
        ["AR"] = new StateMetadata("AR", "Arkansas", false),
        ["CA"] = new StateMetadata("CA", "California", false),
        ["CO"] = new StateMetadata("CO", "Colorado", false),
        ["CT"] = new StateMetadata("CT", "Connecticut", false),
        ["DE"] = new StateMetadata("DE", "Delaware", false),
        ["FL"] = new StateMetadata("FL", "Florida", false),
        ["GA"] = new StateMetadata("GA", "Georgia", false),
        ["HI"] = new StateMetadata("HI", "Hawaii", false),
        ["ID"] = new StateMetadata("ID", "Idaho", false),
        ["IL"] = new StateMetadata("IL", "Illinois", false),
        ["IN"] = new StateMetadata("IN", "Indiana", false),
        ["IA"] = new StateMetadata("IA", "Iowa", false),
        ["KS"] = new StateMetadata("KS", "Kansas", false),
        ["KY"] = new StateMetadata("KY", "Kentucky", false),
        ["LA"] = new StateMetadata("LA", "Louisiana", false),
        ["ME"] = new StateMetadata("ME", "Maine", false),
        ["MD"] = new StateMetadata("MD", "Maryland", false),
        ["MA"] = new StateMetadata("MA", "Massachusetts", false),
        ["MI"] = new StateMetadata("MI", "Michigan", false),
        ["MN"] = new StateMetadata("MN", "Minnesota", false),
        ["MS"] = new StateMetadata("MS", "Mississippi", false),
        ["MO"] = new StateMetadata("MO", "Missouri", false),
        ["MT"] = new StateMetadata("MT", "Montana", false),
        ["NE"] = new StateMetadata("NE", "Nebraska", false),
        ["NV"] = new StateMetadata("NV", "Nevada", false),
        ["NH"] = new StateMetadata("NH", "New Hampshire", false),
        ["NJ"] = new StateMetadata("NJ", "New Jersey", false),
        ["NM"] = new StateMetadata("NM", "New Mexico", false),
        ["NY"] = new StateMetadata("NY", "New York", false),
        ["NC"] = new StateMetadata("NC", "North Carolina", false),
        ["ND"] = new StateMetadata("ND", "North Dakota", false),
        ["OH"] = new StateMetadata("OH", "Ohio", false),
        ["OK"] = new StateMetadata("OK", "Oklahoma", false),
        ["OR"] = new StateMetadata("OR", "Oregon", false),
        ["PA"] = new StateMetadata("PA", "Pennsylvania", false),
        ["RI"] = new StateMetadata("RI", "Rhode Island", false),
        ["SC"] = new StateMetadata("SC", "South Carolina", false),
        ["SD"] = new StateMetadata("SD", "South Dakota", false),
        ["TN"] = new StateMetadata("TN", "Tennessee", false),
        ["TX"] = new StateMetadata("TX", "Texas", false),
        ["UT"] = new StateMetadata("UT", "Utah", false),
        ["VT"] = new StateMetadata("VT", "Vermont", false),
        ["VA"] = new StateMetadata("VA", "Virginia", false),
        ["WA"] = new StateMetadata("WA", "Washington", false),
        ["WV"] = new StateMetadata("WV", "West Virginia", false),
        ["WI"] = new StateMetadata("WI", "Wisconsin", false),
        ["WY"] = new StateMetadata("WY", "Wyoming", false),
        ["DC"] = new StateMetadata("DC", "District of Columbia", false),
        ["AS"] = new StateMetadata("AS", "American Samoa", true),
        ["GU"] = new StateMetadata("GU", "Guam", true),
        ["MP"] = new StateMetadata("MP", "Northern Mariana Islands", true),
        ["PR"] = new StateMetadata("PR", "Puerto Rico", true),
        ["VI"] = new StateMetadata("VI", "United States Virgin Islands", true),
    });

    private static readonly IReadOnlyDictionary<string, string> BY_NAME = new ReadOnlyDictionary<string, string>(new Dictionary<string, string>
    {
        ["alabama"] = "AL",
        ["alaska"] = "AK",
        ["arizona"] = "AZ",
        ["arkansas"] = "AR",
        ["california"] = "CA",
        ["colorado"] = "CO",
        ["connecticut"] = "CT",
        ["delaware"] = "DE",
        ["florida"] = "FL",
        ["georgia"] = "GA",
        ["hawaii"] = "HI",
        ["idaho"] = "ID",
        ["illinois"] = "IL",
        ["indiana"] = "IN",
        ["iowa"] = "IA",
        ["kansas"] = "KS",
        ["kentucky"] = "KY",
        ["louisiana"] = "LA",
        ["maine"] = "ME",
        ["maryland"] = "MD",
        ["massachusetts"] = "MA",
        ["michigan"] = "MI",
        ["minnesota"] = "MN",
        ["mississippi"] = "MS",
        ["missouri"] = "MO",
        ["montana"] = "MT",
        ["nebraska"] = "NE",
        ["nevada"] = "NV",
        ["new hampshire"] = "NH",
        ["new jersey"] = "NJ",
        ["new mexico"] = "NM",
        ["new york"] = "NY",
        ["north carolina"] = "NC",
        ["north dakota"] = "ND",
        ["ohio"] = "OH",
        ["oklahoma"] = "OK",
        ["oregon"] = "OR",
        ["pennsylvania"] = "PA",
        ["rhode island"] = "RI",
        ["south carolina"] = "SC",
        ["south dakota"] = "SD",
        ["tennessee"] = "TN",
        ["texas"] = "TX",
        ["utah"] = "UT",
        ["vermont"] = "VT",
        ["virginia"] = "VA",
        ["washington"] = "WA",
        ["west virginia"] = "WV",
        ["wisconsin"] = "WI",
        ["wyoming"] = "WY",
        ["district of columbia"] = "DC",
        ["american samoa"] = "AS",
        ["guam"] = "GU",
        ["northern mariana islands"] = "MP",
        ["puerto rico"] = "PR",
        ["united states virgin islands"] = "VI",
    });

    private static readonly IReadOnlyDictionary<string, State> BY_ABBR = new ReadOnlyDictionary<string, State>(new Dictionary<string, State>
    {
        ["AL"] = State.Alabama,
        ["AK"] = State.Alaska,
        ["AZ"] = State.Arizona,
        ["AR"] = State.Arkansas,
        ["CA"] = State.California,
        ["CO"] = State.Colorado,
        ["CT"] = State.Connecticut,
        ["DE"] = State.Delaware,
        ["FL"] = State.Florida,
        ["GA"] = State.Georgia,
        ["HI"] = State.Hawaii,
        ["ID"] = State.Idaho,
        ["IL"] = State.Illinois,
        ["IN"] = State.Indiana,
        ["IA"] = State.Iowa,
        ["KS"] = State.Kansas,
        ["KY"] = State.Kentucky,
        ["LA"] = State.Louisiana,
        ["ME"] = State.Maine,
        ["MD"] = State.Maryland,
        ["MA"] = State.Massachusetts,
        ["MI"] = State.Michigan,
        ["MN"] = State.Minnesota,
        ["MS"] = State.Mississippi,
        ["MO"] = State.Missouri,
        ["MT"] = State.Montana,
        ["NE"] = State.Nebraska,
        ["NV"] = State.Nevada,
        ["NH"] = State.NewHampshire,
        ["NJ"] = State.NewJersey,
        ["NM"] = State.NewMexico,
        ["NY"] = State.NewYork,
        ["NC"] = State.NorthCarolina,
        ["ND"] = State.NorthDakota,
        ["OH"] = State.Ohio,
        ["OK"] = State.Oklahoma,
        ["OR"] = State.Oregon,
        ["PA"] = State.Pennsylvania,
        ["RI"] = State.RhodeIsland,
        ["SC"] = State.SouthCarolina,
        ["SD"] = State.SouthDakota,
        ["TN"] = State.Tennessee,
        ["TX"] = State.Texas,
        ["UT"] = State.Utah,
        ["VT"] = State.Vermont,
        ["VA"] = State.Virginia,
        ["WA"] = State.Washington,
        ["WV"] = State.WestVirginia,
        ["WI"] = State.Wisconsin,
        ["WY"] = State.Wyoming,
        ["DC"] = State.DistrictOfColumbia,
        ["AS"] = State.AmericanSamoa,
        ["GU"] = State.Guam,
        ["MP"] = State.NorthernMarianaIslands,
        ["PR"] = State.PuertoRico,
        ["VI"] = State.UnitedStatesVirginIslands,
    });

    private static readonly State[] ALL = (State[])Enum.GetValues(typeof(State));

    /// <summary>Every state in catalog order.</summary>
    public static IReadOnlyList<State> Values() => ALL;

    /// <summary>Metadata lookup for a <see cref="State"/> enum value.</summary>
    public static StateMetadata Metadata(State s)
    {
        var abbr = WireValue(s);
        if (!METADATA.TryGetValue(abbr, out var m))
            throw new ArgumentException($"States.Metadata: unknown state '{s}'", nameof(s));
        return m;
    }

    /// <summary>Look up a state by ISO abbreviation (case-insensitive) or by
    /// full English name (case-insensitive). Returns null when not recognized.</summary>
    public static State? ByAbbreviation(string abbr)
    {
        if (string.IsNullOrEmpty(abbr)) return null;
        var upper = abbr.ToUpperInvariant();
        if (BY_ABBR.TryGetValue(upper, out var s1)) return s1;
        var lower = abbr.ToLowerInvariant();
        if (BY_NAME.TryGetValue(lower, out var key) && BY_ABBR.TryGetValue(key, out var s2)) return s2;
        return null;
    }

    /// <summary>Canonical wire-form value for a <see cref="State"/>.</summary>
    public static string WireValue(State s)
    {
        var member = typeof(State).GetField(s.ToString());
        if (member is null) return s.ToString();
        var attr = member.GetCustomAttribute<WireValueAttribute>();
        return attr is not null ? attr.Value : s.ToString();
    }
}
