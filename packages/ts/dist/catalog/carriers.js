/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */
import { Product } from './products.js';
const CARRIERS = Object.freeze({
    'aetna': { displayName: "Aetna", products: [Product.FexAetnaAccendo, Product.FexAetnaProtectionSeries, Product.MedsupAetnaMedsup], states: [] },
    'aetna-accendo': { displayName: "Aetna Accendo", products: [Product.MedsupAetnaAccendoMedsup], states: [] },
    'aflac': { displayName: "Aflac", products: [Product.FexAflacFinalExpense], states: [] },
    'american-amicable': { displayName: "American Amicable", products: [Product.FexAmericanAmicableClearChoice, Product.FexAmericanAmicableDignitySolutions, Product.FexAmericanAmicableGoldenSolution, Product.FexAmericanAmicableInnovativeSolutions, Product.FexAmericanAmicablePlatinumSolutionLegacyPlan, Product.FexAmericanAmicableSeniorChoice, Product.FexAmericanAmicableTribute, Product.TermAmericanAmicableEasyTerm, Product.TermAmericanAmicableHomeProtector, Product.TermAmericanAmicableTermMadeSimple], states: [] },
    'american-home-life': { displayName: "American Home Life", products: [Product.FexAmericanHomeLifeGuidestar, Product.FexAmericanHomeLifePatriotSeries], states: [] },
    'americo': { displayName: "Americo", products: [Product.FexAmericoEaglePremier, Product.TermAmericoHmsPlus], states: [] },
    'ameritas': { displayName: "Ameritas", products: [Product.TermAmeritasFlxLivingBenefitsTerm, Product.TermAmeritasValuePlusTerm], states: [] },
    'baltimore-life': { displayName: "Baltimore Life", products: [Product.FexBaltimoreLifeIprovide, Product.FexBaltimoreLifeSilverGuard], states: [] },
    'banner': { displayName: "Banner", products: [Product.TermBannerOpterm], states: [] },
    'betterlife': { displayName: "BetterLife", products: [Product.FexBetterlifeFinalExpense, Product.PreneedBetterlifeSinglePremium], states: [] },
    'centrian': { displayName: "Centrian", products: [Product.FexCentrianLivingLegacy], states: [] },
    'cica-life': { displayName: "CICA Life", products: [Product.FexCicaLifeSuperiorChoice], states: [] },
    'cigna': { displayName: "Cigna", products: [Product.FexCignaIndividualWholeLife], states: [] },
    'combined': { displayName: "Combined", products: [Product.FexCombinedGenerationalLife], states: [] },
    'corebridge': { displayName: "Corebridge", products: [Product.FexCorebridgeGiwl, Product.FexCorebridgeSimplinowLegacy, Product.TermCorebridgeSelectATerm], states: [] },
    'emc': { displayName: "EMC", products: [Product.FexEmcEasylife], states: [] },
    'everest-ia-american': { displayName: "Everest IA American", products: [Product.FexEverestIaAmericanAdvantage50Plus], states: [] },
    'family-benefit-life': { displayName: "Family Benefit Life", products: [Product.FexFamilyBenefitLifeGoldenEagle], states: [] },
    'fidelity-life': { displayName: "Fidelity Life", products: [Product.FexFidelityLifeRapidecision, Product.FexFidelityLifeRapidecisionSeniorLife, Product.TermFidelityLifeInstabrainPureTerm, Product.TermFidelityLifeInstabrainTerm, Product.TermFidelityLifeInstaterm], states: [] },
    'first-guaranty-insurance': { displayName: "First Guaranty Insurance", products: [Product.FexFirstGuarantyInsuranceSecurityCare], states: [] },
    'foresters': { displayName: "Foresters", products: [Product.FexForestersPlanRight, Product.TermForestersStrongFoundation, Product.TermForestersYourTerm, Product.TermForestersYourTermNonMedical], states: [] },
    'gerber': { displayName: "Gerber", products: [Product.FexGerberLife], states: [] },
    'global-atlantic': { displayName: "Global Atlantic", products: [Product.PreneedGlobalAtlanticSimpleProtectionPlan], states: [] },
    'gpm': { displayName: "GPM", products: [Product.TermGpmQMark], states: [] },
    'gpm-life': { displayName: "GPM Life", products: [Product.FexGpmLifeSecureMark], states: [] },
    'gtl': { displayName: "GTL", products: [Product.FexGtlHeritagePlan, Product.TermGtlTurboTerm], states: [] },
    'hero-life': { displayName: "Hero Life", products: [Product.TermHeroLifeTerm], states: [] },
    'illinois-mutual': { displayName: "Illinois Mutual", products: [Product.FexIllinoisMutualPathProtectorPlus], states: [] },
    'john-hancock': { displayName: "John Hancock", products: [Product.TermJohnHancockSimpleTermWithVitality], states: [] },
    'kansas-city-life': { displayName: "Kansas City Life", products: [Product.TermKansasCityLifeSignatureTermExpress], states: [] },
    'kskj': { displayName: "KSKJ", products: [Product.FexKskjFinalExpense], states: [] },
    'liberty-bankers': { displayName: "Liberty Bankers", products: [Product.FexLibertyBankersSimpl], states: [] },
    'life-shield': { displayName: "Life Shield", products: [Product.FexLifeShieldSurvivor], states: [] },
    'lincoln': { displayName: "Lincoln", products: [Product.TermLincolnLifeelements, Product.TermLincolnTermaccel], states: [] },
    'manhattan-life': { displayName: "Manhattan Life", products: [Product.FexManhattanLifeSecureAdvantage, Product.MedsupManhattanLifeMedsup], states: [] },
    'mutual-of-omaha': { displayName: "Mutual of Omaha", products: [Product.FexMutualOfOmahaLivingPromise, Product.MedsupMutualOfOmahaMedsup, Product.TermMutualOfOmahaTermLifeAnswers, Product.TermMutualOfOmahaTermLifeExpress], states: [] },
    'nationwide': { displayName: "Nationwide", products: [Product.TermNationwideYourlife], states: [] },
    'newbridge': { displayName: "Newbridge", products: [Product.FexNewbridgeFinalExpense], states: [] },
    'north-american': { displayName: "North American", products: [Product.TermNorthAmericanAddvantage], states: [] },
    'occidental-life': { displayName: "Occidental Life", products: [Product.FexOccidentalLifeClearChoice, Product.FexOccidentalLifeDignitySolutions, Product.FexOccidentalLifeGoldenSolution, Product.FexOccidentalLifeInnovativeSolutions, Product.FexOccidentalLifePlatinumSolutionLegacyPlan, Product.FexOccidentalLifeSeniorChoice, Product.FexOccidentalLifeTribute], states: [] },
    'oxford-life': { displayName: "Oxford Life", products: [Product.FexOxfordLifeSimplifiedIssue], states: [] },
    'pekin': { displayName: "Pekin", products: [Product.FexPekinWholeLife], states: [] },
    'pioneer-american': { displayName: "Pioneer American", products: [Product.FexPioneerAmericanIndependentAmerican, Product.FexPioneerAmericanNorthstarLegacy], states: [] },
    'prosperity': { displayName: "Prosperity", products: [Product.TermProsperityFamilyFreedomTerm], states: [] },
    'protective-life': { displayName: "Protective Life", products: [Product.TermProtectiveLifeClassicChoiceTerm, Product.TermProtectiveLifeCustomChoiceTerm], states: [] },
    'prudential': { displayName: "Prudential", products: [Product.TermPrudentialEssentialTermPlus, Product.TermPrudentialEssentialTermValue], states: [] },
    'royal-arcanum': { displayName: "Royal Arcanum", products: [Product.FexRoyalArcanumGraded, Product.FexRoyalArcanumSimplifiedIssue], states: [] },
    'royal-neighbors': { displayName: "Royal Neighbors", products: [Product.FexRoyalNeighborsEnsuredLegacy], states: [] },
    's-usa': { displayName: "S.USA", products: [Product.FexSUsaGoldenPromise], states: [] },
    'sagicor': { displayName: "Sagicor", products: [Product.TermSagicorSageTerm], states: [] },
    'sbli': { displayName: "SBLI", products: [Product.FexSbliLivingLegacy, Product.TermSbliTTerm], states: [] },
    'securico-life': { displayName: "Securico Life", products: [Product.FexSecuricoLifeFinalExpense], states: [] },
    'security-national': { displayName: "Security National", products: [Product.FexSecurityNationalSimpleSecurity], states: [] },
    'senior-life': { displayName: "Senior Life", products: [Product.FexSeniorLifeWholeLife, Product.TermSeniorLifeTermLife], states: [] },
    'sentinel-security': { displayName: "Sentinel Security", products: [Product.FexSentinelSecurityNewVantage], states: [] },
    'sons-of-norway': { displayName: "Sons of Norway", products: [Product.FexSonsOfNorwayLegacySure, Product.FexSonsOfNorwayWholeLife], states: [] },
    'transamerica': { displayName: "TransAmerica", products: [Product.FexTransamericaFeExpressSolution, Product.FexTransamericaSolution, Product.TermTransamericaTrendsetterLb, Product.TermTransamericaTrendsetterSuper], states: [] },
    'trinity': { displayName: "Trinity", products: [Product.FexTrinityGoldenEagle], states: [] },
    'united-farm-and-family': { displayName: "United Farm And Family", products: [Product.FexUnitedFarmAndFamilyWholeLife], states: [] },
    'united-home-life': { displayName: "United Home Life", products: [Product.FexUnitedHomeLifeWholeLife], states: [] },
    'william-penn': { displayName: "William Penn", products: [Product.TermWilliamPennOpterm], states: [] },
});
const ALL_CARRIERS = Object.freeze(['aetna', 'aetna-accendo', 'aflac', 'american-amicable', 'american-home-life', 'americo', 'ameritas', 'baltimore-life', 'banner', 'betterlife', 'centrian', 'cica-life', 'cigna', 'combined', 'corebridge', 'emc', 'everest-ia-american', 'family-benefit-life', 'fidelity-life', 'first-guaranty-insurance', 'foresters', 'gerber', 'global-atlantic', 'gpm', 'gpm-life', 'gtl', 'hero-life', 'illinois-mutual', 'john-hancock', 'kansas-city-life', 'kskj', 'liberty-bankers', 'life-shield', 'lincoln', 'manhattan-life', 'mutual-of-omaha', 'nationwide', 'newbridge', 'north-american', 'occidental-life', 'oxford-life', 'pekin', 'pioneer-american', 'prosperity', 'protective-life', 'prudential', 'royal-arcanum', 'royal-neighbors', 's-usa', 'sagicor', 'sbli', 'securico-life', 'security-national', 'senior-life', 'sentinel-security', 'sons-of-norway', 'transamerica', 'trinity', 'united-farm-and-family', 'united-home-life', 'william-penn']);
/**
 * Catalog API for carriers. Carrier slugs are stable; display names follow
 * the engine's product catalog.
 *
 * `states` is empty today — per-carrier licensure is not currently
 * surfaced in the public reference data. Treat as advisory.
 */
export const ProductCarriers = Object.freeze({
    values() {
        return ALL_CARRIERS;
    },
    metadata(c) {
        const m = CARRIERS[c];
        if (!m)
            throw new Error(`ProductCarriers.metadata: unknown carrier '${c}'`);
        return m;
    },
});
//# sourceMappingURL=carriers.js.map