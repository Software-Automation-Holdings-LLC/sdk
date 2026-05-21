// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - insurance/v2_products.json

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Sah.Sdk.Catalog;

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
        ["aetna"] = new ProductCarrierMetadata("Aetna", new[] { Product.FexAetnaAccendo, Product.FexAetnaProtectionSeries, Product.MedsupAetnaMedsup }),
        ["aetna-accendo"] = new ProductCarrierMetadata("Aetna Accendo", new[] { Product.MedsupAetnaAccendoMedsup }),
        ["aflac"] = new ProductCarrierMetadata("Aflac", new[] { Product.FexAflacFinalExpense }),
        ["american-amicable"] = new ProductCarrierMetadata("American Amicable", new[] { Product.FexAmericanAmicableClearChoice, Product.FexAmericanAmicableDignitySolutions, Product.FexAmericanAmicableGoldenSolution, Product.FexAmericanAmicableInnovativeSolutions, Product.FexAmericanAmicablePlatinumSolutionLegacyPlan, Product.FexAmericanAmicableSeniorChoice, Product.FexAmericanAmicableTribute, Product.TermAmericanAmicableEasyTerm, Product.TermAmericanAmicableHomeProtector, Product.TermAmericanAmicableTermMadeSimple }),
        ["american-home-life"] = new ProductCarrierMetadata("American Home Life", new[] { Product.FexAmericanHomeLifeGuidestar, Product.FexAmericanHomeLifePatriotSeries }),
        ["americo"] = new ProductCarrierMetadata("Americo", new[] { Product.FexAmericoEaglePremier, Product.TermAmericoHmsPlus }),
        ["ameritas"] = new ProductCarrierMetadata("Ameritas", new[] { Product.TermAmeritasFlxLivingBenefitsTerm, Product.TermAmeritasValuePlusTerm }),
        ["baltimore-life"] = new ProductCarrierMetadata("Baltimore Life", new[] { Product.FexBaltimoreLifeIprovide, Product.FexBaltimoreLifeSilverGuard }),
        ["banner"] = new ProductCarrierMetadata("Banner", new[] { Product.TermBannerOpterm }),
        ["betterlife"] = new ProductCarrierMetadata("BetterLife", new[] { Product.FexBetterlifeFinalExpense, Product.PreneedBetterlifeSinglePremium }),
        ["centrian"] = new ProductCarrierMetadata("Centrian", new[] { Product.FexCentrianLivingLegacy }),
        ["cica-life"] = new ProductCarrierMetadata("CICA Life", new[] { Product.FexCicaLifeSuperiorChoice }),
        ["cigna"] = new ProductCarrierMetadata("Cigna", new[] { Product.FexCignaIndividualWholeLife }),
        ["combined"] = new ProductCarrierMetadata("Combined", new[] { Product.FexCombinedGenerationalLife }),
        ["corebridge"] = new ProductCarrierMetadata("Corebridge", new[] { Product.FexCorebridgeGiwl, Product.FexCorebridgeSimplinowLegacy, Product.TermCorebridgeSelectATerm }),
        ["emc"] = new ProductCarrierMetadata("EMC", new[] { Product.FexEmcEasylife }),
        ["everest-ia-american"] = new ProductCarrierMetadata("Everest IA American", new[] { Product.FexEverestIaAmericanAdvantage50Plus }),
        ["family-benefit-life"] = new ProductCarrierMetadata("Family Benefit Life", new[] { Product.FexFamilyBenefitLifeGoldenEagle }),
        ["fidelity-life"] = new ProductCarrierMetadata("Fidelity Life", new[] { Product.FexFidelityLifeRapidecision, Product.FexFidelityLifeRapidecisionSeniorLife, Product.TermFidelityLifeInstabrainTerm, Product.TermFidelityLifeInstaterm }),
        ["first-guaranty-insurance"] = new ProductCarrierMetadata("First Guaranty Insurance", new[] { Product.FexFirstGuarantyInsuranceSecurityCare }),
        ["foresters"] = new ProductCarrierMetadata("Foresters", new[] { Product.FexForestersPlanRight, Product.TermForestersStrongFoundation, Product.TermForestersYourTerm, Product.TermForestersYourTermNonMedical }),
        ["gerber"] = new ProductCarrierMetadata("Gerber", new[] { Product.FexGerberLife }),
        ["global-atlantic"] = new ProductCarrierMetadata("Global Atlantic", new[] { Product.PreneedGlobalAtlanticSimpleProtectionPlan }),
        ["gpm"] = new ProductCarrierMetadata("GPM", new[] { Product.TermGpmQMark }),
        ["gpm-life"] = new ProductCarrierMetadata("GPM Life", new[] { Product.FexGpmLifeSecureMark }),
        ["gtl"] = new ProductCarrierMetadata("GTL", new[] { Product.FexGtlHeritagePlan, Product.TermGtlTurboTerm }),
        ["hero-life"] = new ProductCarrierMetadata("Hero Life", new[] { Product.TermHeroLifeTerm }),
        ["illinois-mutual"] = new ProductCarrierMetadata("Illinois Mutual", new[] { Product.FexIllinoisMutualPathProtectorPlus }),
        ["john-hancock"] = new ProductCarrierMetadata("John Hancock", new[] { Product.TermJohnHancockSimpleTermWithVitality }),
        ["kansas-city-life"] = new ProductCarrierMetadata("Kansas City Life", new[] { Product.TermKansasCityLifeSignatureTermExpress }),
        ["kskj"] = new ProductCarrierMetadata("KSKJ", new[] { Product.FexKskjFinalExpense }),
        ["liberty-bankers"] = new ProductCarrierMetadata("Liberty Bankers", new[] { Product.FexLibertyBankersSimpl }),
        ["life-shield"] = new ProductCarrierMetadata("Life Shield", new[] { Product.FexLifeShieldSurvivor }),
        ["lincoln"] = new ProductCarrierMetadata("Lincoln", new[] { Product.TermLincolnLifeelements, Product.TermLincolnTermaccel }),
        ["manhattan-life"] = new ProductCarrierMetadata("Manhattan Life", new[] { Product.FexManhattanLifeSecureAdvantage, Product.MedsupManhattanLifeMedsup }),
        ["mutual-of-omaha"] = new ProductCarrierMetadata("Mutual of Omaha", new[] { Product.FexMutualOfOmahaLivingPromise, Product.MedsupMutualOfOmahaMedsup, Product.TermMutualOfOmahaTermLifeAnswers, Product.TermMutualOfOmahaTermLifeExpress }),
        ["nationwide"] = new ProductCarrierMetadata("Nationwide", new[] { Product.TermNationwideYourlife }),
        ["newbridge"] = new ProductCarrierMetadata("Newbridge", new[] { Product.FexNewbridgeFinalExpense }),
        ["north-american"] = new ProductCarrierMetadata("North American", new[] { Product.TermNorthAmericanAddvantage }),
        ["occidental-life"] = new ProductCarrierMetadata("Occidental Life", new[] { Product.FexOccidentalLifeClearChoice, Product.FexOccidentalLifeDignitySolutions, Product.FexOccidentalLifeGoldenSolution, Product.FexOccidentalLifeInnovativeSolutions, Product.FexOccidentalLifePlatinumSolutionLegacyPlan, Product.FexOccidentalLifeSeniorChoice, Product.FexOccidentalLifeTribute }),
        ["oxford-life"] = new ProductCarrierMetadata("Oxford Life", new[] { Product.FexOxfordLifeSimplifiedIssue }),
        ["pekin"] = new ProductCarrierMetadata("Pekin", new[] { Product.FexPekinWholeLife }),
        ["pioneer-american"] = new ProductCarrierMetadata("Pioneer American", new[] { Product.FexPioneerAmericanIndependentAmerican, Product.FexPioneerAmericanNorthstarLegacy }),
        ["prosperity"] = new ProductCarrierMetadata("Prosperity", new[] { Product.TermProsperityFamilyFreedomTerm }),
        ["protective-life"] = new ProductCarrierMetadata("Protective Life", new[] { Product.TermProtectiveLifeClassicChoiceTerm, Product.TermProtectiveLifeCustomChoiceTerm }),
        ["prudential"] = new ProductCarrierMetadata("Prudential", new[] { Product.TermPrudentialEssentialTermPlus, Product.TermPrudentialEssentialTermValue }),
        ["royal-arcanum"] = new ProductCarrierMetadata("Royal Arcanum", new[] { Product.FexRoyalArcanumGraded, Product.FexRoyalArcanumSimplifiedIssue }),
        ["royal-neighbors"] = new ProductCarrierMetadata("Royal Neighbors", new[] { Product.FexRoyalNeighborsEnsuredLegacy }),
        ["s-usa"] = new ProductCarrierMetadata("S.USA", new[] { Product.FexSUsaGoldenPromise }),
        ["sagicor"] = new ProductCarrierMetadata("Sagicor", new[] { Product.TermSagicorSageTerm }),
        ["sbli"] = new ProductCarrierMetadata("SBLI", new[] { Product.FexSbliLivingLegacy, Product.TermSbliTTerm }),
        ["securico-life"] = new ProductCarrierMetadata("Securico Life", new[] { Product.FexSecuricoLifeFinalExpense }),
        ["security-national"] = new ProductCarrierMetadata("Security National", new[] { Product.FexSecurityNationalSimpleSecurity }),
        ["senior-life"] = new ProductCarrierMetadata("Senior Life", new[] { Product.FexSeniorLifeWholeLife, Product.TermSeniorLifeTermLife }),
        ["sentinel-security"] = new ProductCarrierMetadata("Sentinel Security", new[] { Product.FexSentinelSecurityNewVantage }),
        ["sons-of-norway"] = new ProductCarrierMetadata("Sons of Norway", new[] { Product.FexSonsOfNorwayLegacySure, Product.FexSonsOfNorwayWholeLife }),
        ["transamerica"] = new ProductCarrierMetadata("TransAmerica", new[] { Product.FexTransamericaFeExpressSolution, Product.FexTransamericaSolution, Product.TermTransamericaTrendsetterLb, Product.TermTransamericaTrendsetterSuper }),
        ["trinity"] = new ProductCarrierMetadata("Trinity", new[] { Product.FexTrinityGoldenEagle }),
        ["united-farm-and-family"] = new ProductCarrierMetadata("United Farm And Family", new[] { Product.FexUnitedFarmAndFamilyWholeLife }),
        ["united-home-life"] = new ProductCarrierMetadata("United Home Life", new[] { Product.FexUnitedHomeLifeWholeLife }),
        ["william-penn"] = new ProductCarrierMetadata("William Penn", new[] { Product.TermWilliamPennOpterm }),
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
