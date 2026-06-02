/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */
/**
 * Product slug enum. Each member's value is the canonical product identifier
 * the platform uses in URLs and reference-data lookups.
 *
 * `ages`, `states`, and `faceAmount` ranges are placeholders today —
 * the upstream catalog does not expose per-product underwriting bounds in a
 * stable, public-facing form. Treat them as advisory zeros until the engine
 * publishes a normalized catalog dump (tracked separately).
 */
export declare enum Product {
    FexAetnaAccendo = "fex-aetna-accendo",
    FexAetnaProtectionSeries = "fex-aetna-protection-series",
    FexAflacFinalExpense = "fex-aflac-final-expense",
    FexAmericanAmicableClearChoice = "fex-american-amicable-clear-choice",
    FexAmericanAmicableDignitySolutions = "fex-american-amicable-dignity-solutions",
    FexAmericanAmicableGoldenSolution = "fex-american-amicable-golden-solution",
    FexAmericanAmicableInnovativeSolutions = "fex-american-amicable-innovative-solutions",
    FexAmericanAmicablePlatinumSolutionLegacyPlan = "fex-american-amicable-platinum-solution-legacy-plan",
    FexAmericanAmicableSeniorChoice = "fex-american-amicable-senior-choice",
    FexAmericanAmicableTribute = "fex-american-amicable-tribute",
    FexAmericanHomeLifeGuidestar = "fex-american-home-life-guidestar",
    FexAmericanHomeLifePatriotSeries = "fex-american-home-life-patriot-series",
    FexAmericoEaglePremier = "fex-americo-eagle-premier",
    FexBaltimoreLifeIprovide = "fex-baltimore-life-iprovide",
    FexBaltimoreLifeSilverGuard = "fex-baltimore-life-silver-guard",
    FexBetterlifeFinalExpense = "fex-betterlife-final-expense",
    FexCentrianLivingLegacy = "fex-centrian-living-legacy",
    FexCicaLifeSuperiorChoice = "fex-cica-life-superior-choice",
    FexCignaIndividualWholeLife = "fex-cigna-individual-whole-life",
    FexCombinedGenerationalLife = "fex-combined-generational-life",
    FexCorebridgeGiwl = "fex-corebridge-giwl",
    FexCorebridgeSimplinowLegacy = "fex-corebridge-simplinow-legacy",
    FexEmcEasylife = "fex-emc-easylife",
    FexEverestIaAmericanAdvantage50Plus = "fex-everest-ia-american-advantage-50-plus",
    FexFamilyBenefitLifeGoldenEagle = "fex-family-benefit-life-golden-eagle",
    FexFidelityLifeRapidecision = "fex-fidelity-life-rapidecision",
    FexFidelityLifeRapidecisionSeniorLife = "fex-fidelity-life-rapidecision-senior-life",
    FexFirstGuarantyInsuranceSecurityCare = "fex-first-guaranty-insurance-security-care",
    FexForestersPlanRight = "fex-foresters-plan-right",
    FexGerberLife = "fex-gerber-life",
    FexGpmLifeSecureMark = "fex-gpm-life-secure-mark",
    FexGtlHeritagePlan = "fex-gtl-heritage-plan",
    FexIllinoisMutualPathProtectorPlus = "fex-illinois-mutual-path-protector-plus",
    FexKskjFinalExpense = "fex-kskj-final-expense",
    FexLibertyBankersSimpl = "fex-liberty-bankers-simpl",
    FexLifeShieldSurvivor = "fex-life-shield-survivor",
    FexManhattanLifeSecureAdvantage = "fex-manhattan-life-secure-advantage",
    FexMutualOfOmahaLivingPromise = "fex-mutual-of-omaha-living-promise",
    FexNewbridgeFinalExpense = "fex-newbridge-final-expense",
    FexOccidentalLifeClearChoice = "fex-occidental-life-clear-choice",
    FexOccidentalLifeDignitySolutions = "fex-occidental-life-dignity-solutions",
    FexOccidentalLifeGoldenSolution = "fex-occidental-life-golden-solution",
    FexOccidentalLifeInnovativeSolutions = "fex-occidental-life-innovative-solutions",
    FexOccidentalLifePlatinumSolutionLegacyPlan = "fex-occidental-life-platinum-solution-legacy-plan",
    FexOccidentalLifeSeniorChoice = "fex-occidental-life-senior-choice",
    FexOccidentalLifeTribute = "fex-occidental-life-tribute",
    FexOxfordLifeSimplifiedIssue = "fex-oxford-life-simplified-issue",
    FexPekinWholeLife = "fex-pekin-whole-life",
    FexPioneerAmericanIndependentAmerican = "fex-pioneer-american-independent-american",
    FexPioneerAmericanNorthstarLegacy = "fex-pioneer-american-northstar-legacy",
    FexRoyalArcanumGraded = "fex-royal-arcanum-graded",
    FexRoyalArcanumSimplifiedIssue = "fex-royal-arcanum-simplified-issue",
    FexRoyalNeighborsEnsuredLegacy = "fex-royal-neighbors-ensured-legacy",
    FexSUsaGoldenPromise = "fex-s.usa-golden-promise",
    FexSbliLivingLegacy = "fex-sbli-living-legacy",
    FexSecuricoLifeFinalExpense = "fex-securico-life-final-expense",
    FexSecurityNationalSimpleSecurity = "fex-security-national-simple-security",
    FexSeniorLifeWholeLife = "fex-senior-life-whole-life",
    FexSentinelSecurityNewVantage = "fex-sentinel-security-new-vantage",
    FexSonsOfNorwayLegacySure = "fex-sons-of-norway-legacy-sure",
    FexSonsOfNorwayWholeLife = "fex-sons-of-norway-whole-life",
    FexTransamericaFeExpressSolution = "fex-transamerica-fe-express-solution",
    FexTransamericaSolution = "fex-transamerica-solution",
    FexTrinityGoldenEagle = "fex-trinity-golden-eagle",
    FexUnitedFarmAndFamilyWholeLife = "fex-united-farm-and-family-whole-life",
    FexUnitedHomeLifeWholeLife = "fex-united-home-life-whole-life",
    MedsupAetnaAccendoMedsup = "medsup-aetna-accendo-medsup",
    MedsupAetnaMedsup = "medsup-aetna-medsup",
    MedsupManhattanLifeMedsup = "medsup-manhattan-life-medsup",
    MedsupMutualOfOmahaMedsup = "medsup-mutual-of-omaha-medsup",
    PreneedBetterlifeSinglePremium = "preneed-betterlife-single-premium",
    PreneedGlobalAtlanticSimpleProtectionPlan = "preneed-global-atlantic-simple-protection-plan",
    TermAmericanAmicableEasyTerm = "term-american-amicable-easy-term",
    TermAmericanAmicableHomeProtector = "term-american-amicable-home-protector",
    TermAmericanAmicableTermMadeSimple = "term-american-amicable-term-made-simple",
    TermAmericoHmsPlus = "term-americo-hms-plus",
    TermAmeritasFlxLivingBenefitsTerm = "term-ameritas-flx-living-benefits-term",
    TermAmeritasValuePlusTerm = "term-ameritas-value-plus-term",
    TermBannerOpterm = "term-banner-opterm",
    TermCorebridgeSelectATerm = "term-corebridge-select-a-term",
    TermFidelityLifeInstabrainPureTerm = "term-fidelity-life-instabrain-pure-term",
    TermFidelityLifeInstabrainTerm = "term-fidelity-life-instabrain-term",
    TermFidelityLifeInstaterm = "term-fidelity-life-instaterm",
    TermForestersStrongFoundation = "term-foresters-strong-foundation",
    TermForestersYourTerm = "term-foresters-your-term",
    TermForestersYourTermNonMedical = "term-foresters-your-term-non-medical",
    TermGpmQMark = "term-gpm-q-mark",
    TermGtlTurboTerm = "term-gtl-turbo-term",
    TermHeroLifeTerm = "term-hero-life-term",
    TermJohnHancockSimpleTermWithVitality = "term-john-hancock-simple-term-with-vitality",
    TermKansasCityLifeSignatureTermExpress = "term-kansas-city-life-signature-term-express",
    TermLincolnLifeelements = "term-lincoln-lifeelements",
    TermLincolnTermaccel = "term-lincoln-termaccel",
    TermMutualOfOmahaTermLifeAnswers = "term-mutual-of-omaha-term-life-answers",
    TermMutualOfOmahaTermLifeExpress = "term-mutual-of-omaha-term-life-express",
    TermNationwideYourlife = "term-nationwide-yourlife",
    TermNorthAmericanAddvantage = "term-north-american-addvantage",
    TermProsperityFamilyFreedomTerm = "term-prosperity-family-freedom-term",
    TermProtectiveLifeClassicChoiceTerm = "term-protective-life-classic-choice-term",
    TermProtectiveLifeCustomChoiceTerm = "term-protective-life-custom-choice-term",
    TermPrudentialEssentialTermPlus = "term-prudential-essential-term-plus",
    TermPrudentialEssentialTermValue = "term-prudential-essential-term-value",
    TermSagicorSageTerm = "term-sagicor-sage-term",
    TermSbliTTerm = "term-sbli-t-term",
    TermSeniorLifeTermLife = "term-senior-life-term-life",
    TermTransamericaTrendsetterLb = "term-transamerica-trendsetter-lb",
    TermTransamericaTrendsetterSuper = "term-transamerica-trendsetter-super",
    TermWilliamPennOpterm = "term-william-penn-opterm"
}
/** Public metadata for a single `Product`. */
export interface ProductMetadata {
    readonly slug: string;
    readonly displayName: string;
    /** Carrier slug. Look up display name via `ProductCarriers.metadata`. */
    readonly carrier: string;
    /** Product class: `fex`, `term`, `medsup`, `preneed`, etc. */
    readonly productClass: string;
    readonly ages: {
        readonly min: number;
        readonly max: number;
    };
    /** ISO 2-letter state codes the product is filed in. */
    readonly states: readonly string[];
    readonly faceAmount: {
        readonly min: number;
        readonly max: number;
    };
    /** Display-name variants used for state-specific product filings. */
    readonly stateVariations: readonly string[];
}
/** Catalog API for `Product`. All methods return frozen, sorted views. */
export declare const Products: Readonly<{
    /** Every product slug. Sorted alphabetically. */
    values(): readonly Product[];
    /** `[Product, ProductMetadata]` pairs in catalog order. */
    entries(): ReadonlyArray<readonly [Product, ProductMetadata]>;
    /** Products filed by a given carrier slug. Case-insensitive match. */
    byCarrier(carrier: string): readonly Product[];
    /**
     * Substring search across slug, display name, and state-specific names.
     * Returns matches sorted by relevance (prefix matches first, then
     * substring matches).
     */
    search(query: string): readonly Product[];
    /** Metadata lookup; throws on unknown slug (the enum makes that impossible at compile time). */
    metadata(p: Product): ProductMetadata;
}>;
//# sourceMappingURL=products.d.ts.map