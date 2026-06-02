// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - insurance/v2_products.json

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Isa.Sdk.Catalog;

/// <summary>Public metadata for a single carrier. Today's catalog does not
/// expose per-carrier licensure data; <c>States</c> is intentionally omitted.</summary>
public sealed record ProductCarrierMetadata(
    string DisplayName,
    IReadOnlyList<Product> Products);

/// <summary>Catalog API for carriers.</summary>
public static class ProductCarriers
{
    private static readonly IReadOnlyDictionary<string, ProductCarrierMetadata> CARRIERS = new ReadOnlyDictionary<string, ProductCarrierMetadata>(new Dictionary<string, ProductCarrierMetadata>
    {
        ["aetna"] = new ProductCarrierMetadata("Aetna", new[] { Products.Fex.AetnaAccendo, Products.Fex.AetnaProtectionSeries, Products.Medsup.AetnaMedsup }),
        ["aetna-accendo"] = new ProductCarrierMetadata("Aetna Accendo", new[] { Products.Medsup.AetnaAccendoMedsup }),
        ["aflac"] = new ProductCarrierMetadata("Aflac", new[] { Products.Fex.AflacFinalExpense }),
        ["american-amicable"] = new ProductCarrierMetadata("American Amicable", new[] { Products.Fex.AmericanAmicableClearChoice, Products.Fex.AmericanAmicableDignitySolutions, Products.Fex.AmericanAmicableGoldenSolution, Products.Fex.AmericanAmicableInnovativeSolutions, Products.Fex.AmericanAmicablePlatinumSolutionLegacyPlan, Products.Fex.AmericanAmicableSeniorChoice, Products.Fex.AmericanAmicableTribute, Products.Term.AmericanAmicableEasyTerm, Products.Term.AmericanAmicableHomeProtector, Products.Term.AmericanAmicableTermMadeSimple }),
        ["american-home-life"] = new ProductCarrierMetadata("American Home Life", new[] { Products.Fex.AmericanHomeLifeGuidestar, Products.Fex.AmericanHomeLifePatriotSeries }),
        ["americo"] = new ProductCarrierMetadata("Americo", new[] { Products.Fex.AmericoEaglePremier, Products.Term.AmericoHmsPlus }),
        ["ameritas"] = new ProductCarrierMetadata("Ameritas", new[] { Products.Term.AmeritasFlxLivingBenefitsTerm, Products.Term.AmeritasValuePlusTerm }),
        ["baltimore-life"] = new ProductCarrierMetadata("Baltimore Life", new[] { Products.Fex.BaltimoreLifeIprovide, Products.Fex.BaltimoreLifeSilverGuard }),
        ["banner"] = new ProductCarrierMetadata("Banner", new[] { Products.Term.BannerOpterm }),
        ["betterlife"] = new ProductCarrierMetadata("BetterLife", new[] { Products.Fex.BetterlifeFinalExpense, Products.Preneed.BetterlifeSinglePremium }),
        ["centrian"] = new ProductCarrierMetadata("Centrian", new[] { Products.Fex.CentrianLivingLegacy }),
        ["cica-life"] = new ProductCarrierMetadata("CICA Life", new[] { Products.Fex.CicaLifeSuperiorChoice }),
        ["cigna"] = new ProductCarrierMetadata("Cigna", new[] { Products.Fex.CignaIndividualWholeLife }),
        ["combined"] = new ProductCarrierMetadata("Combined", new[] { Products.Fex.CombinedGenerationalLife }),
        ["corebridge"] = new ProductCarrierMetadata("Corebridge", new[] { Products.Fex.CorebridgeGiwl, Products.Fex.CorebridgeSimplinowLegacy, Products.Term.CorebridgeSelectATerm }),
        ["emc"] = new ProductCarrierMetadata("EMC", new[] { Products.Fex.EmcEasylife }),
        ["everest-ia-american"] = new ProductCarrierMetadata("Everest IA American", new[] { Products.Fex.EverestIaAmericanAdvantage50Plus }),
        ["family-benefit-life"] = new ProductCarrierMetadata("Family Benefit Life", new[] { Products.Fex.FamilyBenefitLifeGoldenEagle }),
        ["fidelity-life"] = new ProductCarrierMetadata("Fidelity Life", new[] { Products.Fex.FidelityLifeRapidecision, Products.Fex.FidelityLifeRapidecisionSeniorLife, Products.Term.FidelityLifeInstabrainPureTerm, Products.Term.FidelityLifeInstabrainTerm, Products.Term.FidelityLifeInstaterm }),
        ["first-guaranty-insurance"] = new ProductCarrierMetadata("First Guaranty Insurance", new[] { Products.Fex.FirstGuarantyInsuranceSecurityCare }),
        ["foresters"] = new ProductCarrierMetadata("Foresters", new[] { Products.Fex.ForestersPlanRight, Products.Term.ForestersStrongFoundation, Products.Term.ForestersYourTerm, Products.Term.ForestersYourTermNonMedical }),
        ["gerber"] = new ProductCarrierMetadata("Gerber", new[] { Products.Fex.GerberLife }),
        ["global-atlantic"] = new ProductCarrierMetadata("Global Atlantic", new[] { Products.Preneed.GlobalAtlanticSimpleProtectionPlan }),
        ["gpm"] = new ProductCarrierMetadata("GPM", new[] { Products.Term.GpmQMark }),
        ["gpm-life"] = new ProductCarrierMetadata("GPM Life", new[] { Products.Fex.GpmLifeSecureMark }),
        ["gtl"] = new ProductCarrierMetadata("GTL", new[] { Products.Fex.GtlHeritagePlan, Products.Term.GtlTurboTerm }),
        ["hero-life"] = new ProductCarrierMetadata("Hero Life", new[] { Products.Term.HeroLifeTerm }),
        ["illinois-mutual"] = new ProductCarrierMetadata("Illinois Mutual", new[] { Products.Fex.IllinoisMutualPathProtectorPlus }),
        ["john-hancock"] = new ProductCarrierMetadata("John Hancock", new[] { Products.Term.JohnHancockSimpleTermWithVitality }),
        ["kansas-city-life"] = new ProductCarrierMetadata("Kansas City Life", new[] { Products.Term.KansasCityLifeSignatureTermExpress }),
        ["kskj"] = new ProductCarrierMetadata("KSKJ", new[] { Products.Fex.KskjFinalExpense }),
        ["liberty-bankers"] = new ProductCarrierMetadata("Liberty Bankers", new[] { Products.Fex.LibertyBankersSimpl }),
        ["life-shield"] = new ProductCarrierMetadata("Life Shield", new[] { Products.Fex.LifeShieldSurvivor }),
        ["lincoln"] = new ProductCarrierMetadata("Lincoln", new[] { Products.Term.LincolnLifeelements, Products.Term.LincolnTermaccel }),
        ["manhattan-life"] = new ProductCarrierMetadata("Manhattan Life", new[] { Products.Fex.ManhattanLifeSecureAdvantage, Products.Medsup.ManhattanLifeMedsup }),
        ["mutual-of-omaha"] = new ProductCarrierMetadata("Mutual of Omaha", new[] { Products.Fex.MutualOfOmahaLivingPromise, Products.Medsup.MutualOfOmahaMedsup, Products.Term.MutualOfOmahaTermLifeAnswers, Products.Term.MutualOfOmahaTermLifeExpress }),
        ["nationwide"] = new ProductCarrierMetadata("Nationwide", new[] { Products.Term.NationwideYourlife }),
        ["newbridge"] = new ProductCarrierMetadata("Newbridge", new[] { Products.Fex.NewbridgeFinalExpense }),
        ["north-american"] = new ProductCarrierMetadata("North American", new[] { Products.Term.NorthAmericanAddvantage }),
        ["occidental-life"] = new ProductCarrierMetadata("Occidental Life", new[] { Products.Fex.OccidentalLifeClearChoice, Products.Fex.OccidentalLifeDignitySolutions, Products.Fex.OccidentalLifeGoldenSolution, Products.Fex.OccidentalLifeInnovativeSolutions, Products.Fex.OccidentalLifePlatinumSolutionLegacyPlan, Products.Fex.OccidentalLifeSeniorChoice, Products.Fex.OccidentalLifeTribute }),
        ["oxford-life"] = new ProductCarrierMetadata("Oxford Life", new[] { Products.Fex.OxfordLifeSimplifiedIssue }),
        ["pekin"] = new ProductCarrierMetadata("Pekin", new[] { Products.Fex.PekinWholeLife }),
        ["pioneer-american"] = new ProductCarrierMetadata("Pioneer American", new[] { Products.Fex.PioneerAmericanIndependentAmerican, Products.Fex.PioneerAmericanNorthstarLegacy }),
        ["prosperity"] = new ProductCarrierMetadata("Prosperity", new[] { Products.Term.ProsperityFamilyFreedomTerm }),
        ["protective-life"] = new ProductCarrierMetadata("Protective Life", new[] { Products.Term.ProtectiveLifeClassicChoiceTerm, Products.Term.ProtectiveLifeCustomChoiceTerm }),
        ["prudential"] = new ProductCarrierMetadata("Prudential", new[] { Products.Term.PrudentialEssentialTermPlus, Products.Term.PrudentialEssentialTermValue }),
        ["royal-arcanum"] = new ProductCarrierMetadata("Royal Arcanum", new[] { Products.Fex.RoyalArcanumGraded, Products.Fex.RoyalArcanumSimplifiedIssue }),
        ["royal-neighbors"] = new ProductCarrierMetadata("Royal Neighbors", new[] { Products.Fex.RoyalNeighborsEnsuredLegacy }),
        ["s-usa"] = new ProductCarrierMetadata("S.USA", new[] { Products.Fex.SUsaGoldenPromise }),
        ["sagicor"] = new ProductCarrierMetadata("Sagicor", new[] { Products.Term.SagicorSageTerm }),
        ["sbli"] = new ProductCarrierMetadata("SBLI", new[] { Products.Fex.SbliLivingLegacy, Products.Term.SbliTTerm }),
        ["securico-life"] = new ProductCarrierMetadata("Securico Life", new[] { Products.Fex.SecuricoLifeFinalExpense }),
        ["security-national"] = new ProductCarrierMetadata("Security National", new[] { Products.Fex.SecurityNationalSimpleSecurity }),
        ["senior-life"] = new ProductCarrierMetadata("Senior Life", new[] { Products.Fex.SeniorLifeWholeLife, Products.Term.SeniorLifeTermLife }),
        ["sentinel-security"] = new ProductCarrierMetadata("Sentinel Security", new[] { Products.Fex.SentinelSecurityNewVantage }),
        ["sons-of-norway"] = new ProductCarrierMetadata("Sons of Norway", new[] { Products.Fex.SonsOfNorwayLegacySure, Products.Fex.SonsOfNorwayWholeLife }),
        ["transamerica"] = new ProductCarrierMetadata("TransAmerica", new[] { Products.Fex.TransamericaFeExpressSolution, Products.Fex.TransamericaSolution, Products.Term.TransamericaTrendsetterLb, Products.Term.TransamericaTrendsetterSuper }),
        ["trinity"] = new ProductCarrierMetadata("Trinity", new[] { Products.Fex.TrinityGoldenEagle }),
        ["united-farm-and-family"] = new ProductCarrierMetadata("United Farm And Family", new[] { Products.Fex.UnitedFarmAndFamilyWholeLife }),
        ["united-home-life"] = new ProductCarrierMetadata("United Home Life", new[] { Products.Fex.UnitedHomeLifeWholeLife }),
        ["william-penn"] = new ProductCarrierMetadata("William Penn", new[] { Products.Term.WilliamPennOpterm }),
    });

    /// <summary>Every carrier slug.</summary>
    public static IReadOnlyCollection<string> Values() => new List<string>(CARRIERS.Keys).AsReadOnly();

    /// <summary>Metadata lookup for a carrier slug. Case-insensitive.</summary>
    public static ProductCarrierMetadata Metadata(string carrier)
    {
        if (carrier is null) throw new ArgumentNullException(nameof(carrier));
        var key = carrier.ToLowerInvariant();
        if (!CARRIERS.TryGetValue(key, out var m))
            throw new ArgumentException($"ProductCarriers.Metadata: unknown carrier '{carrier}'", nameof(carrier));
        return m;
    }
}
