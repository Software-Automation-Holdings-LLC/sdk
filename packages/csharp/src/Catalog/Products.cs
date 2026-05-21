// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - insurance/v2_products.json

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Reflection;

namespace Sah.Sdk.Catalog;

/// <summary>Product slug enum. Each member's wire value is the canonical product
/// identifier the platform uses in URLs and reference-data lookups.</summary>
public enum Product
{
    /// <summary>Aetna Accendo (fex-aetna-accendo).</summary>
    [WireValue("fex-aetna-accendo")] FexAetnaAccendo,
    /// <summary>Aetna Protection Series (fex-aetna-protection-series).</summary>
    [WireValue("fex-aetna-protection-series")] FexAetnaProtectionSeries,
    /// <summary>Aflac Final Expense (fex-aflac-final-expense).</summary>
    [WireValue("fex-aflac-final-expense")] FexAflacFinalExpense,
    /// <summary>American Amicable Clear Choice (fex-american-amicable-clear-choice).</summary>
    [WireValue("fex-american-amicable-clear-choice")] FexAmericanAmicableClearChoice,
    /// <summary>American Amicable Dignity Solutions (fex-american-amicable-dignity-solutions).</summary>
    [WireValue("fex-american-amicable-dignity-solutions")] FexAmericanAmicableDignitySolutions,
    /// <summary>American Amicable Golden Solution (fex-american-amicable-golden-solution).</summary>
    [WireValue("fex-american-amicable-golden-solution")] FexAmericanAmicableGoldenSolution,
    /// <summary>American Amicable Innovative Solutions (fex-american-amicable-innovative-solutions).</summary>
    [WireValue("fex-american-amicable-innovative-solutions")] FexAmericanAmicableInnovativeSolutions,
    /// <summary>American Amicable Platinum Solution Legacy Plan (fex-american-amicable-platinum-solution-legacy-plan).</summary>
    [WireValue("fex-american-amicable-platinum-solution-legacy-plan")] FexAmericanAmicablePlatinumSolutionLegacyPlan,
    /// <summary>American Amicable Senior Choice (fex-american-amicable-senior-choice).</summary>
    [WireValue("fex-american-amicable-senior-choice")] FexAmericanAmicableSeniorChoice,
    /// <summary>American Amicable Tribute (fex-american-amicable-tribute).</summary>
    [WireValue("fex-american-amicable-tribute")] FexAmericanAmicableTribute,
    /// <summary>American Home Life Guidestar (fex-american-home-life-guidestar).</summary>
    [WireValue("fex-american-home-life-guidestar")] FexAmericanHomeLifeGuidestar,
    /// <summary>American Home Life Patriot Series (fex-american-home-life-patriot-series).</summary>
    [WireValue("fex-american-home-life-patriot-series")] FexAmericanHomeLifePatriotSeries,
    /// <summary>Americo Eagle Premier (fex-americo-eagle-premier).</summary>
    [WireValue("fex-americo-eagle-premier")] FexAmericoEaglePremier,
    /// <summary>Baltimore Life iProvide (fex-baltimore-life-iprovide).</summary>
    [WireValue("fex-baltimore-life-iprovide")] FexBaltimoreLifeIprovide,
    /// <summary>Baltimore Life Silver Guard (fex-baltimore-life-silver-guard).</summary>
    [WireValue("fex-baltimore-life-silver-guard")] FexBaltimoreLifeSilverGuard,
    /// <summary>BetterLife Final Expense (fex-betterlife-final-expense).</summary>
    [WireValue("fex-betterlife-final-expense")] FexBetterlifeFinalExpense,
    /// <summary>Centrian Living Legacy (fex-centrian-living-legacy).</summary>
    [WireValue("fex-centrian-living-legacy")] FexCentrianLivingLegacy,
    /// <summary>CICA Life Superior Choice (fex-cica-life-superior-choice).</summary>
    [WireValue("fex-cica-life-superior-choice")] FexCicaLifeSuperiorChoice,
    /// <summary>Cigna Individual Whole Life (fex-cigna-individual-whole-life).</summary>
    [WireValue("fex-cigna-individual-whole-life")] FexCignaIndividualWholeLife,
    /// <summary>Combined Generational Life (fex-combined-generational-life).</summary>
    [WireValue("fex-combined-generational-life")] FexCombinedGenerationalLife,
    /// <summary>Corebridge GIWL (fex-corebridge-giwl).</summary>
    [WireValue("fex-corebridge-giwl")] FexCorebridgeGiwl,
    /// <summary>Corebridge SimpliNow Legacy (fex-corebridge-simplinow-legacy).</summary>
    [WireValue("fex-corebridge-simplinow-legacy")] FexCorebridgeSimplinowLegacy,
    /// <summary>EMC EasyLife (fex-emc-easylife).</summary>
    [WireValue("fex-emc-easylife")] FexEmcEasylife,
    /// <summary>Everest IA American Advantage 50 Plus (fex-everest-ia-american-advantage-50-plus).</summary>
    [WireValue("fex-everest-ia-american-advantage-50-plus")] FexEverestIaAmericanAdvantage50Plus,
    /// <summary>Family Benefit Life Golden Eagle (fex-family-benefit-life-golden-eagle).</summary>
    [WireValue("fex-family-benefit-life-golden-eagle")] FexFamilyBenefitLifeGoldenEagle,
    /// <summary>Fidelity Life RAPIDecision (fex-fidelity-life-rapidecision).</summary>
    [WireValue("fex-fidelity-life-rapidecision")] FexFidelityLifeRapidecision,
    /// <summary>Fidelity Life RAPIDecision Senior Life (fex-fidelity-life-rapidecision-senior-life).</summary>
    [WireValue("fex-fidelity-life-rapidecision-senior-life")] FexFidelityLifeRapidecisionSeniorLife,
    /// <summary>First Guaranty Insurance Security Care (fex-first-guaranty-insurance-security-care).</summary>
    [WireValue("fex-first-guaranty-insurance-security-care")] FexFirstGuarantyInsuranceSecurityCare,
    /// <summary>Foresters Plan Right (fex-foresters-plan-right).</summary>
    [WireValue("fex-foresters-plan-right")] FexForestersPlanRight,
    /// <summary>Gerber Life (fex-gerber-life).</summary>
    [WireValue("fex-gerber-life")] FexGerberLife,
    /// <summary>GPM Life Secure Mark (fex-gpm-life-secure-mark).</summary>
    [WireValue("fex-gpm-life-secure-mark")] FexGpmLifeSecureMark,
    /// <summary>GTL Heritage Plan (fex-gtl-heritage-plan).</summary>
    [WireValue("fex-gtl-heritage-plan")] FexGtlHeritagePlan,
    /// <summary>Illinois Mutual Path Protector Plus (fex-illinois-mutual-path-protector-plus).</summary>
    [WireValue("fex-illinois-mutual-path-protector-plus")] FexIllinoisMutualPathProtectorPlus,
    /// <summary>KSKJ Final Expense (fex-kskj-final-expense).</summary>
    [WireValue("fex-kskj-final-expense")] FexKskjFinalExpense,
    /// <summary>Liberty Bankers Simpl (fex-liberty-bankers-simpl).</summary>
    [WireValue("fex-liberty-bankers-simpl")] FexLibertyBankersSimpl,
    /// <summary>Life Shield Survivor (fex-life-shield-survivor).</summary>
    [WireValue("fex-life-shield-survivor")] FexLifeShieldSurvivor,
    /// <summary>Manhattan Life Secure Advantage (fex-manhattan-life-secure-advantage).</summary>
    [WireValue("fex-manhattan-life-secure-advantage")] FexManhattanLifeSecureAdvantage,
    /// <summary>Mutual of Omaha Living Promise (fex-mutual-of-omaha-living-promise).</summary>
    [WireValue("fex-mutual-of-omaha-living-promise")] FexMutualOfOmahaLivingPromise,
    /// <summary>Newbridge Final Expense (fex-newbridge-final-expense).</summary>
    [WireValue("fex-newbridge-final-expense")] FexNewbridgeFinalExpense,
    /// <summary>Occidental Life Clear Choice (fex-occidental-life-clear-choice).</summary>
    [WireValue("fex-occidental-life-clear-choice")] FexOccidentalLifeClearChoice,
    /// <summary>Occidental Life Dignity Solutions (fex-occidental-life-dignity-solutions).</summary>
    [WireValue("fex-occidental-life-dignity-solutions")] FexOccidentalLifeDignitySolutions,
    /// <summary>Occidental Life Golden Solution (fex-occidental-life-golden-solution).</summary>
    [WireValue("fex-occidental-life-golden-solution")] FexOccidentalLifeGoldenSolution,
    /// <summary>Occidental Life Innovative Solutions (fex-occidental-life-innovative-solutions).</summary>
    [WireValue("fex-occidental-life-innovative-solutions")] FexOccidentalLifeInnovativeSolutions,
    /// <summary>Occidental Life Platinum Solution Legacy Plan (fex-occidental-life-platinum-solution-legacy-plan).</summary>
    [WireValue("fex-occidental-life-platinum-solution-legacy-plan")] FexOccidentalLifePlatinumSolutionLegacyPlan,
    /// <summary>Occidental Life Senior Choice (fex-occidental-life-senior-choice).</summary>
    [WireValue("fex-occidental-life-senior-choice")] FexOccidentalLifeSeniorChoice,
    /// <summary>Occidental Life Tribute (fex-occidental-life-tribute).</summary>
    [WireValue("fex-occidental-life-tribute")] FexOccidentalLifeTribute,
    /// <summary>Oxford Life Simplified Issue (fex-oxford-life-simplified-issue).</summary>
    [WireValue("fex-oxford-life-simplified-issue")] FexOxfordLifeSimplifiedIssue,
    /// <summary>Pekin Whole Life (fex-pekin-whole-life).</summary>
    [WireValue("fex-pekin-whole-life")] FexPekinWholeLife,
    /// <summary>Pioneer American Independent American (fex-pioneer-american-independent-american).</summary>
    [WireValue("fex-pioneer-american-independent-american")] FexPioneerAmericanIndependentAmerican,
    /// <summary>Pioneer American NorthStar Legacy (fex-pioneer-american-northstar-legacy).</summary>
    [WireValue("fex-pioneer-american-northstar-legacy")] FexPioneerAmericanNorthstarLegacy,
    /// <summary>Royal Arcanum Graded (fex-royal-arcanum-graded).</summary>
    [WireValue("fex-royal-arcanum-graded")] FexRoyalArcanumGraded,
    /// <summary>Royal Arcanum Simplified Issue (fex-royal-arcanum-simplified-issue).</summary>
    [WireValue("fex-royal-arcanum-simplified-issue")] FexRoyalArcanumSimplifiedIssue,
    /// <summary>Royal Neighbors Ensured Legacy (fex-royal-neighbors-ensured-legacy).</summary>
    [WireValue("fex-royal-neighbors-ensured-legacy")] FexRoyalNeighborsEnsuredLegacy,
    /// <summary>S.USA Golden Promise (fex-s.usa-golden-promise).</summary>
    [WireValue("fex-s.usa-golden-promise")] FexSUsaGoldenPromise,
    /// <summary>SBLI Living Legacy (fex-sbli-living-legacy).</summary>
    [WireValue("fex-sbli-living-legacy")] FexSbliLivingLegacy,
    /// <summary>Securico Life Final Expense (fex-securico-life-final-expense).</summary>
    [WireValue("fex-securico-life-final-expense")] FexSecuricoLifeFinalExpense,
    /// <summary>Security National Simple Security (fex-security-national-simple-security).</summary>
    [WireValue("fex-security-national-simple-security")] FexSecurityNationalSimpleSecurity,
    /// <summary>Senior Life Whole Life (fex-senior-life-whole-life).</summary>
    [WireValue("fex-senior-life-whole-life")] FexSeniorLifeWholeLife,
    /// <summary>Sentinel Security New Vantage (fex-sentinel-security-new-vantage).</summary>
    [WireValue("fex-sentinel-security-new-vantage")] FexSentinelSecurityNewVantage,
    /// <summary>Sons of Norway Legacy Sure (fex-sons-of-norway-legacy-sure).</summary>
    [WireValue("fex-sons-of-norway-legacy-sure")] FexSonsOfNorwayLegacySure,
    /// <summary>Sons of Norway Whole Life (fex-sons-of-norway-whole-life).</summary>
    [WireValue("fex-sons-of-norway-whole-life")] FexSonsOfNorwayWholeLife,
    /// <summary>TransAmerica FE Express Solution (fex-transamerica-fe-express-solution).</summary>
    [WireValue("fex-transamerica-fe-express-solution")] FexTransamericaFeExpressSolution,
    /// <summary>TransAmerica Solution (fex-transamerica-solution).</summary>
    [WireValue("fex-transamerica-solution")] FexTransamericaSolution,
    /// <summary>Trinity Golden Eagle (fex-trinity-golden-eagle).</summary>
    [WireValue("fex-trinity-golden-eagle")] FexTrinityGoldenEagle,
    /// <summary>United Farm And Family Whole Life (fex-united-farm-and-family-whole-life).</summary>
    [WireValue("fex-united-farm-and-family-whole-life")] FexUnitedFarmAndFamilyWholeLife,
    /// <summary>United Home Life Whole Life (fex-united-home-life-whole-life).</summary>
    [WireValue("fex-united-home-life-whole-life")] FexUnitedHomeLifeWholeLife,
    /// <summary>Aetna Accendo Medicare Supplement (medsup-aetna-accendo-medsup).</summary>
    [WireValue("medsup-aetna-accendo-medsup")] MedsupAetnaAccendoMedsup,
    /// <summary>Aetna Medicare Supplement (medsup-aetna-medsup).</summary>
    [WireValue("medsup-aetna-medsup")] MedsupAetnaMedsup,
    /// <summary>Manhattan Life Medicare Supplement (medsup-manhattan-life-medsup).</summary>
    [WireValue("medsup-manhattan-life-medsup")] MedsupManhattanLifeMedsup,
    /// <summary>Mutual of Omaha Medicare Supplement (medsup-mutual-of-omaha-medsup).</summary>
    [WireValue("medsup-mutual-of-omaha-medsup")] MedsupMutualOfOmahaMedsup,
    /// <summary>BetterLife Single Premium (preneed-betterlife-single-premium).</summary>
    [WireValue("preneed-betterlife-single-premium")] PreneedBetterlifeSinglePremium,
    /// <summary>Global Atlantic Simple Protection Plan (preneed-global-atlantic-simple-protection-plan).</summary>
    [WireValue("preneed-global-atlantic-simple-protection-plan")] PreneedGlobalAtlanticSimpleProtectionPlan,
    /// <summary>American Amicable Easy Term (term-american-amicable-easy-term).</summary>
    [WireValue("term-american-amicable-easy-term")] TermAmericanAmicableEasyTerm,
    /// <summary>American Amicable Home Protector (term-american-amicable-home-protector).</summary>
    [WireValue("term-american-amicable-home-protector")] TermAmericanAmicableHomeProtector,
    /// <summary>American Amicable Term Made Simple (term-american-amicable-term-made-simple).</summary>
    [WireValue("term-american-amicable-term-made-simple")] TermAmericanAmicableTermMadeSimple,
    /// <summary>Americo HMS PLUS (term-americo-hms-plus).</summary>
    [WireValue("term-americo-hms-plus")] TermAmericoHmsPlus,
    /// <summary>Ameritas FLX Living Benefits Term (term-ameritas-flx-living-benefits-term).</summary>
    [WireValue("term-ameritas-flx-living-benefits-term")] TermAmeritasFlxLivingBenefitsTerm,
    /// <summary>Ameritas Value Plus Term (term-ameritas-value-plus-term).</summary>
    [WireValue("term-ameritas-value-plus-term")] TermAmeritasValuePlusTerm,
    /// <summary>Banner OPTerm (term-banner-opterm).</summary>
    [WireValue("term-banner-opterm")] TermBannerOpterm,
    /// <summary>Corebridge Select A Term (term-corebridge-select-a-term).</summary>
    [WireValue("term-corebridge-select-a-term")] TermCorebridgeSelectATerm,
    /// <summary>Fidelity Life InstaBrain Term (term-fidelity-life-instabrain-term).</summary>
    [WireValue("term-fidelity-life-instabrain-term")] TermFidelityLifeInstabrainTerm,
    /// <summary>Fidelity Life InstaTerm (term-fidelity-life-instaterm).</summary>
    [WireValue("term-fidelity-life-instaterm")] TermFidelityLifeInstaterm,
    /// <summary>Foresters Strong Foundation (term-foresters-strong-foundation).</summary>
    [WireValue("term-foresters-strong-foundation")] TermForestersStrongFoundation,
    /// <summary>Foresters Your Term (term-foresters-your-term).</summary>
    [WireValue("term-foresters-your-term")] TermForestersYourTerm,
    /// <summary>Foresters Your Term Non Medical (term-foresters-your-term-non-medical).</summary>
    [WireValue("term-foresters-your-term-non-medical")] TermForestersYourTermNonMedical,
    /// <summary>GPM Q Mark (term-gpm-q-mark).</summary>
    [WireValue("term-gpm-q-mark")] TermGpmQMark,
    /// <summary>GTL Turbo Term (term-gtl-turbo-term).</summary>
    [WireValue("term-gtl-turbo-term")] TermGtlTurboTerm,
    /// <summary>Hero Life Term (term-hero-life-term).</summary>
    [WireValue("term-hero-life-term")] TermHeroLifeTerm,
    /// <summary>John Hancock Simple Term with Vitality (term-john-hancock-simple-term-with-vitality).</summary>
    [WireValue("term-john-hancock-simple-term-with-vitality")] TermJohnHancockSimpleTermWithVitality,
    /// <summary>Kansas City Life Signature Term Express (term-kansas-city-life-signature-term-express).</summary>
    [WireValue("term-kansas-city-life-signature-term-express")] TermKansasCityLifeSignatureTermExpress,
    /// <summary>Lincoln LifeElements (term-lincoln-lifeelements).</summary>
    [WireValue("term-lincoln-lifeelements")] TermLincolnLifeelements,
    /// <summary>Lincoln TermAccel (term-lincoln-termaccel).</summary>
    [WireValue("term-lincoln-termaccel")] TermLincolnTermaccel,
    /// <summary>Mutual of Omaha Term Life Answers (term-mutual-of-omaha-term-life-answers).</summary>
    [WireValue("term-mutual-of-omaha-term-life-answers")] TermMutualOfOmahaTermLifeAnswers,
    /// <summary>Mutual of Omaha Term Life Express (term-mutual-of-omaha-term-life-express).</summary>
    [WireValue("term-mutual-of-omaha-term-life-express")] TermMutualOfOmahaTermLifeExpress,
    /// <summary>Nationwide YourLife (term-nationwide-yourlife).</summary>
    [WireValue("term-nationwide-yourlife")] TermNationwideYourlife,
    /// <summary>North American ADDvantage (term-north-american-addvantage).</summary>
    [WireValue("term-north-american-addvantage")] TermNorthAmericanAddvantage,
    /// <summary>Prosperity Family Freedom Term (term-prosperity-family-freedom-term).</summary>
    [WireValue("term-prosperity-family-freedom-term")] TermProsperityFamilyFreedomTerm,
    /// <summary>Protective Life Classic Choice Term (term-protective-life-classic-choice-term).</summary>
    [WireValue("term-protective-life-classic-choice-term")] TermProtectiveLifeClassicChoiceTerm,
    /// <summary>Protective Life Custom Choice Term (term-protective-life-custom-choice-term).</summary>
    [WireValue("term-protective-life-custom-choice-term")] TermProtectiveLifeCustomChoiceTerm,
    /// <summary>Prudential Essential Term Plus (term-prudential-essential-term-plus).</summary>
    [WireValue("term-prudential-essential-term-plus")] TermPrudentialEssentialTermPlus,
    /// <summary>Prudential Essential Term Value (term-prudential-essential-term-value).</summary>
    [WireValue("term-prudential-essential-term-value")] TermPrudentialEssentialTermValue,
    /// <summary>Sagicor Sage Term (term-sagicor-sage-term).</summary>
    [WireValue("term-sagicor-sage-term")] TermSagicorSageTerm,
    /// <summary>SBLI T Term (term-sbli-t-term).</summary>
    [WireValue("term-sbli-t-term")] TermSbliTTerm,
    /// <summary>Senior Life Term Life (term-senior-life-term-life).</summary>
    [WireValue("term-senior-life-term-life")] TermSeniorLifeTermLife,
    /// <summary>TransAmerica Trendsetter LB (term-transamerica-trendsetter-lb).</summary>
    [WireValue("term-transamerica-trendsetter-lb")] TermTransamericaTrendsetterLb,
    /// <summary>TransAmerica Trendsetter Super (term-transamerica-trendsetter-super).</summary>
    [WireValue("term-transamerica-trendsetter-super")] TermTransamericaTrendsetterSuper,
    /// <summary>William Penn OPTerm (term-william-penn-opterm).</summary>
    [WireValue("term-william-penn-opterm")] TermWilliamPennOpterm,
}

/// <summary>Public metadata for a single <see cref="Product"/>.</summary>
public sealed record ProductMetadata(
    string Slug,
    string DisplayName,
    string Carrier,
    string ProductClass,
    IReadOnlyList<string> StateVariations);

/// <summary>Catalog API for <see cref="Product"/>. Methods return frozen,
/// sorted views; the underlying tables are constructed once at startup.</summary>
public static class Products
{
    private static readonly IReadOnlyDictionary<string, ProductMetadata> METADATA = new ReadOnlyDictionary<string, ProductMetadata>(new Dictionary<string, ProductMetadata>
    {
        ["fex-aetna-accendo"] = new ProductMetadata("fex-aetna-accendo", "Aetna Accendo", "aetna", "fex", new[] { "Aetna Accendo Montana" }),
        ["fex-aetna-protection-series"] = new ProductMetadata("fex-aetna-protection-series", "Aetna Protection Series", "aetna", "fex", Array.Empty<string>()),
        ["fex-aflac-final-expense"] = new ProductMetadata("fex-aflac-final-expense", "Aflac Final Expense", "aflac", "fex", Array.Empty<string>()),
        ["fex-american-amicable-clear-choice"] = new ProductMetadata("fex-american-amicable-clear-choice", "American Amicable Clear Choice", "american-amicable", "fex", Array.Empty<string>()),
        ["fex-american-amicable-dignity-solutions"] = new ProductMetadata("fex-american-amicable-dignity-solutions", "American Amicable Dignity Solutions", "american-amicable", "fex", Array.Empty<string>()),
        ["fex-american-amicable-golden-solution"] = new ProductMetadata("fex-american-amicable-golden-solution", "American Amicable Golden Solution", "american-amicable", "fex", Array.Empty<string>()),
        ["fex-american-amicable-innovative-solutions"] = new ProductMetadata("fex-american-amicable-innovative-solutions", "American Amicable Innovative Solutions", "american-amicable", "fex", Array.Empty<string>()),
        ["fex-american-amicable-platinum-solution-legacy-plan"] = new ProductMetadata("fex-american-amicable-platinum-solution-legacy-plan", "American Amicable Platinum Solution Legacy Plan", "american-amicable", "fex", Array.Empty<string>()),
        ["fex-american-amicable-senior-choice"] = new ProductMetadata("fex-american-amicable-senior-choice", "American Amicable Senior Choice", "american-amicable", "fex", Array.Empty<string>()),
        ["fex-american-amicable-tribute"] = new ProductMetadata("fex-american-amicable-tribute", "American Amicable Tribute", "american-amicable", "fex", Array.Empty<string>()),
        ["fex-american-home-life-guidestar"] = new ProductMetadata("fex-american-home-life-guidestar", "American Home Life Guidestar", "american-home-life", "fex", Array.Empty<string>()),
        ["fex-american-home-life-patriot-series"] = new ProductMetadata("fex-american-home-life-patriot-series", "American Home Life Patriot Series", "american-home-life", "fex", Array.Empty<string>()),
        ["fex-americo-eagle-premier"] = new ProductMetadata("fex-americo-eagle-premier", "Americo Eagle Premier", "americo", "fex", Array.Empty<string>()),
        ["fex-baltimore-life-iprovide"] = new ProductMetadata("fex-baltimore-life-iprovide", "Baltimore Life iProvide", "baltimore-life", "fex", Array.Empty<string>()),
        ["fex-baltimore-life-silver-guard"] = new ProductMetadata("fex-baltimore-life-silver-guard", "Baltimore Life Silver Guard", "baltimore-life", "fex", Array.Empty<string>()),
        ["fex-betterlife-final-expense"] = new ProductMetadata("fex-betterlife-final-expense", "BetterLife Final Expense", "betterlife", "fex", Array.Empty<string>()),
        ["fex-centrian-living-legacy"] = new ProductMetadata("fex-centrian-living-legacy", "Centrian Living Legacy", "centrian", "fex", Array.Empty<string>()),
        ["fex-cica-life-superior-choice"] = new ProductMetadata("fex-cica-life-superior-choice", "CICA Life Superior Choice", "cica-life", "fex", Array.Empty<string>()),
        ["fex-cigna-individual-whole-life"] = new ProductMetadata("fex-cigna-individual-whole-life", "Cigna Individual Whole Life", "cigna", "fex", Array.Empty<string>()),
        ["fex-combined-generational-life"] = new ProductMetadata("fex-combined-generational-life", "Combined Generational Life", "combined", "fex", Array.Empty<string>()),
        ["fex-corebridge-giwl"] = new ProductMetadata("fex-corebridge-giwl", "Corebridge GIWL", "corebridge", "fex", Array.Empty<string>()),
        ["fex-corebridge-simplinow-legacy"] = new ProductMetadata("fex-corebridge-simplinow-legacy", "Corebridge SimpliNow Legacy", "corebridge", "fex", Array.Empty<string>()),
        ["fex-emc-easylife"] = new ProductMetadata("fex-emc-easylife", "EMC EasyLife", "emc", "fex", Array.Empty<string>()),
        ["fex-everest-ia-american-advantage-50-plus"] = new ProductMetadata("fex-everest-ia-american-advantage-50-plus", "Everest IA American Advantage 50 Plus", "everest-ia-american", "fex", Array.Empty<string>()),
        ["fex-family-benefit-life-golden-eagle"] = new ProductMetadata("fex-family-benefit-life-golden-eagle", "Family Benefit Life Golden Eagle", "family-benefit-life", "fex", Array.Empty<string>()),
        ["fex-fidelity-life-rapidecision"] = new ProductMetadata("fex-fidelity-life-rapidecision", "Fidelity Life RAPIDecision", "fidelity-life", "fex", Array.Empty<string>()),
        ["fex-fidelity-life-rapidecision-senior-life"] = new ProductMetadata("fex-fidelity-life-rapidecision-senior-life", "Fidelity Life RAPIDecision Senior Life", "fidelity-life", "fex", Array.Empty<string>()),
        ["fex-first-guaranty-insurance-security-care"] = new ProductMetadata("fex-first-guaranty-insurance-security-care", "First Guaranty Insurance Security Care", "first-guaranty-insurance", "fex", Array.Empty<string>()),
        ["fex-foresters-plan-right"] = new ProductMetadata("fex-foresters-plan-right", "Foresters Plan Right", "foresters", "fex", Array.Empty<string>()),
        ["fex-gerber-life"] = new ProductMetadata("fex-gerber-life", "Gerber Life", "gerber", "fex", Array.Empty<string>()),
        ["fex-gpm-life-secure-mark"] = new ProductMetadata("fex-gpm-life-secure-mark", "GPM Life Secure Mark", "gpm-life", "fex", Array.Empty<string>()),
        ["fex-gtl-heritage-plan"] = new ProductMetadata("fex-gtl-heritage-plan", "GTL Heritage Plan", "gtl", "fex", Array.Empty<string>()),
        ["fex-illinois-mutual-path-protector-plus"] = new ProductMetadata("fex-illinois-mutual-path-protector-plus", "Illinois Mutual Path Protector Plus", "illinois-mutual", "fex", Array.Empty<string>()),
        ["fex-kskj-final-expense"] = new ProductMetadata("fex-kskj-final-expense", "KSKJ Final Expense", "kskj", "fex", Array.Empty<string>()),
        ["fex-liberty-bankers-simpl"] = new ProductMetadata("fex-liberty-bankers-simpl", "Liberty Bankers Simpl", "liberty-bankers", "fex", Array.Empty<string>()),
        ["fex-life-shield-survivor"] = new ProductMetadata("fex-life-shield-survivor", "Life Shield Survivor", "life-shield", "fex", Array.Empty<string>()),
        ["fex-manhattan-life-secure-advantage"] = new ProductMetadata("fex-manhattan-life-secure-advantage", "Manhattan Life Secure Advantage", "manhattan-life", "fex", Array.Empty<string>()),
        ["fex-mutual-of-omaha-living-promise"] = new ProductMetadata("fex-mutual-of-omaha-living-promise", "Mutual of Omaha Living Promise", "mutual-of-omaha", "fex", Array.Empty<string>()),
        ["fex-newbridge-final-expense"] = new ProductMetadata("fex-newbridge-final-expense", "Newbridge Final Expense", "newbridge", "fex", Array.Empty<string>()),
        ["fex-occidental-life-clear-choice"] = new ProductMetadata("fex-occidental-life-clear-choice", "Occidental Life Clear Choice", "occidental-life", "fex", Array.Empty<string>()),
        ["fex-occidental-life-dignity-solutions"] = new ProductMetadata("fex-occidental-life-dignity-solutions", "Occidental Life Dignity Solutions", "occidental-life", "fex", Array.Empty<string>()),
        ["fex-occidental-life-golden-solution"] = new ProductMetadata("fex-occidental-life-golden-solution", "Occidental Life Golden Solution", "occidental-life", "fex", Array.Empty<string>()),
        ["fex-occidental-life-innovative-solutions"] = new ProductMetadata("fex-occidental-life-innovative-solutions", "Occidental Life Innovative Solutions", "occidental-life", "fex", Array.Empty<string>()),
        ["fex-occidental-life-platinum-solution-legacy-plan"] = new ProductMetadata("fex-occidental-life-platinum-solution-legacy-plan", "Occidental Life Platinum Solution Legacy Plan", "occidental-life", "fex", Array.Empty<string>()),
        ["fex-occidental-life-senior-choice"] = new ProductMetadata("fex-occidental-life-senior-choice", "Occidental Life Senior Choice", "occidental-life", "fex", Array.Empty<string>()),
        ["fex-occidental-life-tribute"] = new ProductMetadata("fex-occidental-life-tribute", "Occidental Life Tribute", "occidental-life", "fex", Array.Empty<string>()),
        ["fex-oxford-life-simplified-issue"] = new ProductMetadata("fex-oxford-life-simplified-issue", "Oxford Life Simplified Issue", "oxford-life", "fex", Array.Empty<string>()),
        ["fex-pekin-whole-life"] = new ProductMetadata("fex-pekin-whole-life", "Pekin Whole Life", "pekin", "fex", Array.Empty<string>()),
        ["fex-pioneer-american-independent-american"] = new ProductMetadata("fex-pioneer-american-independent-american", "Pioneer American Independent American", "pioneer-american", "fex", Array.Empty<string>()),
        ["fex-pioneer-american-northstar-legacy"] = new ProductMetadata("fex-pioneer-american-northstar-legacy", "Pioneer American NorthStar Legacy", "pioneer-american", "fex", Array.Empty<string>()),
        ["fex-royal-arcanum-graded"] = new ProductMetadata("fex-royal-arcanum-graded", "Royal Arcanum Graded", "royal-arcanum", "fex", Array.Empty<string>()),
        ["fex-royal-arcanum-simplified-issue"] = new ProductMetadata("fex-royal-arcanum-simplified-issue", "Royal Arcanum Simplified Issue", "royal-arcanum", "fex", Array.Empty<string>()),
        ["fex-royal-neighbors-ensured-legacy"] = new ProductMetadata("fex-royal-neighbors-ensured-legacy", "Royal Neighbors Ensured Legacy", "royal-neighbors", "fex", Array.Empty<string>()),
        ["fex-s.usa-golden-promise"] = new ProductMetadata("fex-s.usa-golden-promise", "S.USA Golden Promise", "s-usa", "fex", Array.Empty<string>()),
        ["fex-sbli-living-legacy"] = new ProductMetadata("fex-sbli-living-legacy", "SBLI Living Legacy", "sbli", "fex", Array.Empty<string>()),
        ["fex-securico-life-final-expense"] = new ProductMetadata("fex-securico-life-final-expense", "Securico Life Final Expense", "securico-life", "fex", Array.Empty<string>()),
        ["fex-security-national-simple-security"] = new ProductMetadata("fex-security-national-simple-security", "Security National Simple Security", "security-national", "fex", Array.Empty<string>()),
        ["fex-senior-life-whole-life"] = new ProductMetadata("fex-senior-life-whole-life", "Senior Life Whole Life", "senior-life", "fex", Array.Empty<string>()),
        ["fex-sentinel-security-new-vantage"] = new ProductMetadata("fex-sentinel-security-new-vantage", "Sentinel Security New Vantage", "sentinel-security", "fex", Array.Empty<string>()),
        ["fex-sons-of-norway-legacy-sure"] = new ProductMetadata("fex-sons-of-norway-legacy-sure", "Sons of Norway Legacy Sure", "sons-of-norway", "fex", Array.Empty<string>()),
        ["fex-sons-of-norway-whole-life"] = new ProductMetadata("fex-sons-of-norway-whole-life", "Sons of Norway Whole Life", "sons-of-norway", "fex", Array.Empty<string>()),
        ["fex-transamerica-fe-express-solution"] = new ProductMetadata("fex-transamerica-fe-express-solution", "TransAmerica FE Express Solution", "transamerica", "fex", Array.Empty<string>()),
        ["fex-transamerica-solution"] = new ProductMetadata("fex-transamerica-solution", "TransAmerica Solution", "transamerica", "fex", Array.Empty<string>()),
        ["fex-trinity-golden-eagle"] = new ProductMetadata("fex-trinity-golden-eagle", "Trinity Golden Eagle", "trinity", "fex", Array.Empty<string>()),
        ["fex-united-farm-and-family-whole-life"] = new ProductMetadata("fex-united-farm-and-family-whole-life", "United Farm And Family Whole Life", "united-farm-and-family", "fex", Array.Empty<string>()),
        ["fex-united-home-life-whole-life"] = new ProductMetadata("fex-united-home-life-whole-life", "United Home Life Whole Life", "united-home-life", "fex", Array.Empty<string>()),
        ["medsup-aetna-accendo-medsup"] = new ProductMetadata("medsup-aetna-accendo-medsup", "Aetna Accendo Medicare Supplement", "aetna-accendo", "medsup", Array.Empty<string>()),
        ["medsup-aetna-medsup"] = new ProductMetadata("medsup-aetna-medsup", "Aetna Medicare Supplement", "aetna", "medsup", Array.Empty<string>()),
        ["medsup-manhattan-life-medsup"] = new ProductMetadata("medsup-manhattan-life-medsup", "Manhattan Life Medicare Supplement", "manhattan-life", "medsup", Array.Empty<string>()),
        ["medsup-mutual-of-omaha-medsup"] = new ProductMetadata("medsup-mutual-of-omaha-medsup", "Mutual of Omaha Medicare Supplement", "mutual-of-omaha", "medsup", Array.Empty<string>()),
        ["preneed-betterlife-single-premium"] = new ProductMetadata("preneed-betterlife-single-premium", "BetterLife Single Premium", "betterlife", "preneed", Array.Empty<string>()),
        ["preneed-global-atlantic-simple-protection-plan"] = new ProductMetadata("preneed-global-atlantic-simple-protection-plan", "Global Atlantic Simple Protection Plan", "global-atlantic", "preneed", Array.Empty<string>()),
        ["term-american-amicable-easy-term"] = new ProductMetadata("term-american-amicable-easy-term", "American Amicable Easy Term", "american-amicable", "term", Array.Empty<string>()),
        ["term-american-amicable-home-protector"] = new ProductMetadata("term-american-amicable-home-protector", "American Amicable Home Protector", "american-amicable", "term", Array.Empty<string>()),
        ["term-american-amicable-term-made-simple"] = new ProductMetadata("term-american-amicable-term-made-simple", "American Amicable Term Made Simple", "american-amicable", "term", Array.Empty<string>()),
        ["term-americo-hms-plus"] = new ProductMetadata("term-americo-hms-plus", "Americo HMS PLUS", "americo", "term", Array.Empty<string>()),
        ["term-ameritas-flx-living-benefits-term"] = new ProductMetadata("term-ameritas-flx-living-benefits-term", "Ameritas FLX Living Benefits Term", "ameritas", "term", Array.Empty<string>()),
        ["term-ameritas-value-plus-term"] = new ProductMetadata("term-ameritas-value-plus-term", "Ameritas Value Plus Term", "ameritas", "term", Array.Empty<string>()),
        ["term-banner-opterm"] = new ProductMetadata("term-banner-opterm", "Banner OPTerm", "banner", "term", Array.Empty<string>()),
        ["term-corebridge-select-a-term"] = new ProductMetadata("term-corebridge-select-a-term", "Corebridge Select A Term", "corebridge", "term", Array.Empty<string>()),
        ["term-fidelity-life-instabrain-term"] = new ProductMetadata("term-fidelity-life-instabrain-term", "Fidelity Life InstaBrain Term", "fidelity-life", "term", Array.Empty<string>()),
        ["term-fidelity-life-instaterm"] = new ProductMetadata("term-fidelity-life-instaterm", "Fidelity Life InstaTerm", "fidelity-life", "term", Array.Empty<string>()),
        ["term-foresters-strong-foundation"] = new ProductMetadata("term-foresters-strong-foundation", "Foresters Strong Foundation", "foresters", "term", Array.Empty<string>()),
        ["term-foresters-your-term"] = new ProductMetadata("term-foresters-your-term", "Foresters Your Term", "foresters", "term", Array.Empty<string>()),
        ["term-foresters-your-term-non-medical"] = new ProductMetadata("term-foresters-your-term-non-medical", "Foresters Your Term Non Medical", "foresters", "term", Array.Empty<string>()),
        ["term-gpm-q-mark"] = new ProductMetadata("term-gpm-q-mark", "GPM Q Mark", "gpm", "term", Array.Empty<string>()),
        ["term-gtl-turbo-term"] = new ProductMetadata("term-gtl-turbo-term", "GTL Turbo Term", "gtl", "term", Array.Empty<string>()),
        ["term-hero-life-term"] = new ProductMetadata("term-hero-life-term", "Hero Life Term", "hero-life", "term", Array.Empty<string>()),
        ["term-john-hancock-simple-term-with-vitality"] = new ProductMetadata("term-john-hancock-simple-term-with-vitality", "John Hancock Simple Term with Vitality", "john-hancock", "term", Array.Empty<string>()),
        ["term-kansas-city-life-signature-term-express"] = new ProductMetadata("term-kansas-city-life-signature-term-express", "Kansas City Life Signature Term Express", "kansas-city-life", "term", Array.Empty<string>()),
        ["term-lincoln-lifeelements"] = new ProductMetadata("term-lincoln-lifeelements", "Lincoln LifeElements", "lincoln", "term", Array.Empty<string>()),
        ["term-lincoln-termaccel"] = new ProductMetadata("term-lincoln-termaccel", "Lincoln TermAccel", "lincoln", "term", Array.Empty<string>()),
        ["term-mutual-of-omaha-term-life-answers"] = new ProductMetadata("term-mutual-of-omaha-term-life-answers", "Mutual of Omaha Term Life Answers", "mutual-of-omaha", "term", Array.Empty<string>()),
        ["term-mutual-of-omaha-term-life-express"] = new ProductMetadata("term-mutual-of-omaha-term-life-express", "Mutual of Omaha Term Life Express", "mutual-of-omaha", "term", Array.Empty<string>()),
        ["term-nationwide-yourlife"] = new ProductMetadata("term-nationwide-yourlife", "Nationwide YourLife", "nationwide", "term", Array.Empty<string>()),
        ["term-north-american-addvantage"] = new ProductMetadata("term-north-american-addvantage", "North American ADDvantage", "north-american", "term", Array.Empty<string>()),
        ["term-prosperity-family-freedom-term"] = new ProductMetadata("term-prosperity-family-freedom-term", "Prosperity Family Freedom Term", "prosperity", "term", Array.Empty<string>()),
        ["term-protective-life-classic-choice-term"] = new ProductMetadata("term-protective-life-classic-choice-term", "Protective Life Classic Choice Term", "protective-life", "term", Array.Empty<string>()),
        ["term-protective-life-custom-choice-term"] = new ProductMetadata("term-protective-life-custom-choice-term", "Protective Life Custom Choice Term", "protective-life", "term", Array.Empty<string>()),
        ["term-prudential-essential-term-plus"] = new ProductMetadata("term-prudential-essential-term-plus", "Prudential Essential Term Plus", "prudential", "term", Array.Empty<string>()),
        ["term-prudential-essential-term-value"] = new ProductMetadata("term-prudential-essential-term-value", "Prudential Essential Term Value", "prudential", "term", Array.Empty<string>()),
        ["term-sagicor-sage-term"] = new ProductMetadata("term-sagicor-sage-term", "Sagicor Sage Term", "sagicor", "term", Array.Empty<string>()),
        ["term-sbli-t-term"] = new ProductMetadata("term-sbli-t-term", "SBLI T Term", "sbli", "term", Array.Empty<string>()),
        ["term-senior-life-term-life"] = new ProductMetadata("term-senior-life-term-life", "Senior Life Term Life", "senior-life", "term", Array.Empty<string>()),
        ["term-transamerica-trendsetter-lb"] = new ProductMetadata("term-transamerica-trendsetter-lb", "TransAmerica Trendsetter LB", "transamerica", "term", Array.Empty<string>()),
        ["term-transamerica-trendsetter-super"] = new ProductMetadata("term-transamerica-trendsetter-super", "TransAmerica Trendsetter Super", "transamerica", "term", Array.Empty<string>()),
        ["term-william-penn-opterm"] = new ProductMetadata("term-william-penn-opterm", "William Penn OPTerm", "william-penn", "term", Array.Empty<string>()),
    });

    private static readonly Product[] ALL = ((Product[])Enum.GetValues(typeof(Product)))
        .OrderBy(p => WireValue(p), StringComparer.Ordinal)
        .ToArray();

    /// <summary>Every product slug, sorted alphabetically.</summary>
    public static IReadOnlyList<Product> Values() => ALL;

    /// <summary>(<see cref="Product"/>, <see cref="ProductMetadata"/>) pairs in catalog order.</summary>
    public static IReadOnlyList<(Product Product, ProductMetadata Metadata)> Entries() =>
        ALL.Select(p => (p, METADATA[WireValue(p)])).ToList().AsReadOnly();

    /// <summary>Products filed by a given carrier slug. Case-insensitive match.</summary>
    public static IReadOnlyList<Product> ByCarrier(string carrier)
    {
        if (carrier is null) throw new ArgumentNullException(nameof(carrier));
        var target = carrier.ToLowerInvariant();
        return ALL.Where(p => METADATA[WireValue(p)].Carrier == target).ToList().AsReadOnly();
    }

    /// <summary>Substring search across slug + display name. Prefix matches come first.</summary>
    public static IReadOnlyList<Product> Search(string query)
    {
        if (query is null) return Array.Empty<Product>();
        var q = query.Trim().ToLowerInvariant();
        if (q.Length == 0) return Array.Empty<Product>();
        var prefix = new List<Product>();
        var substring = new List<Product>();
        foreach (var p in ALL)
        {
            var m = METADATA[WireValue(p)];
            var disp = m.DisplayName.ToLowerInvariant();
            var hay = m.Slug + " " + disp;
            if (hay.StartsWith(q, StringComparison.Ordinal) || disp.StartsWith(q, StringComparison.Ordinal))
                prefix.Add(p);
            else if (hay.Contains(q))
                substring.Add(p);
        }
        prefix.AddRange(substring);
        return prefix.AsReadOnly();
    }

    /// <summary>Metadata lookup for a <see cref="Product"/> enum value.</summary>
    public static ProductMetadata Metadata(Product p)
    {
        var slug = WireValue(p);
        if (!METADATA.TryGetValue(slug, out var m))
            throw new ArgumentException($"Products.Metadata: unknown product '{p}'", nameof(p));
        return m;
    }

    /// <summary>Canonical wire-form value for a <see cref="Product"/>.</summary>
    public static string WireValue(Product p)
    {
        var member = typeof(Product).GetField(p.ToString());
        if (member is null) return p.ToString();
        var attr = member.GetCustomAttribute<WireValueAttribute>();
        return attr is not null ? attr.Value : p.ToString();
    }
}
