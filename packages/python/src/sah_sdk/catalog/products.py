"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - insurance/v2_products.json
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Product(str, Enum):
    """Product slug enum.

    Each member's value is the canonical product identifier the platform
    uses in URLs and reference-data lookups.

    ``ages``, ``states``, and ``face_amount`` ranges are placeholders today —
    the upstream catalog does not expose per-product underwriting bounds in
    a stable, public-facing form. Treat them as advisory zeros until the
    engine publishes a normalized catalog dump (tracked separately).
    """

    FexAetnaAccendo = 'fex-aetna-accendo'
    FexAetnaProtectionSeries = 'fex-aetna-protection-series'
    FexAflacFinalExpense = 'fex-aflac-final-expense'
    FexAmericanAmicableClearChoice = 'fex-american-amicable-clear-choice'
    FexAmericanAmicableDignitySolutions = 'fex-american-amicable-dignity-solutions'
    FexAmericanAmicableGoldenSolution = 'fex-american-amicable-golden-solution'
    FexAmericanAmicableInnovativeSolutions = 'fex-american-amicable-innovative-solutions'
    FexAmericanAmicablePlatinumSolutionLegacyPlan = 'fex-american-amicable-platinum-solution-legacy-plan'
    FexAmericanAmicableSeniorChoice = 'fex-american-amicable-senior-choice'
    FexAmericanAmicableTribute = 'fex-american-amicable-tribute'
    FexAmericanHomeLifeGuidestar = 'fex-american-home-life-guidestar'
    FexAmericanHomeLifePatriotSeries = 'fex-american-home-life-patriot-series'
    FexAmericoEaglePremier = 'fex-americo-eagle-premier'
    FexBaltimoreLifeIprovide = 'fex-baltimore-life-iprovide'
    FexBaltimoreLifeSilverGuard = 'fex-baltimore-life-silver-guard'
    FexBetterlifeFinalExpense = 'fex-betterlife-final-expense'
    FexCentrianLivingLegacy = 'fex-centrian-living-legacy'
    FexCicaLifeSuperiorChoice = 'fex-cica-life-superior-choice'
    FexCignaIndividualWholeLife = 'fex-cigna-individual-whole-life'
    FexCombinedGenerationalLife = 'fex-combined-generational-life'
    FexCorebridgeGiwl = 'fex-corebridge-giwl'
    FexCorebridgeSimplinowLegacy = 'fex-corebridge-simplinow-legacy'
    FexEmcEasylife = 'fex-emc-easylife'
    FexEverestIaAmericanAdvantage50Plus = 'fex-everest-ia-american-advantage-50-plus'
    FexFamilyBenefitLifeGoldenEagle = 'fex-family-benefit-life-golden-eagle'
    FexFidelityLifeRapidecision = 'fex-fidelity-life-rapidecision'
    FexFidelityLifeRapidecisionSeniorLife = 'fex-fidelity-life-rapidecision-senior-life'
    FexFirstGuarantyInsuranceSecurityCare = 'fex-first-guaranty-insurance-security-care'
    FexForestersPlanRight = 'fex-foresters-plan-right'
    FexGerberLife = 'fex-gerber-life'
    FexGpmLifeSecureMark = 'fex-gpm-life-secure-mark'
    FexGtlHeritagePlan = 'fex-gtl-heritage-plan'
    FexIllinoisMutualPathProtectorPlus = 'fex-illinois-mutual-path-protector-plus'
    FexKskjFinalExpense = 'fex-kskj-final-expense'
    FexLibertyBankersSimpl = 'fex-liberty-bankers-simpl'
    FexLifeShieldSurvivor = 'fex-life-shield-survivor'
    FexManhattanLifeSecureAdvantage = 'fex-manhattan-life-secure-advantage'
    FexMutualOfOmahaLivingPromise = 'fex-mutual-of-omaha-living-promise'
    FexNewbridgeFinalExpense = 'fex-newbridge-final-expense'
    FexOccidentalLifeClearChoice = 'fex-occidental-life-clear-choice'
    FexOccidentalLifeDignitySolutions = 'fex-occidental-life-dignity-solutions'
    FexOccidentalLifeGoldenSolution = 'fex-occidental-life-golden-solution'
    FexOccidentalLifeInnovativeSolutions = 'fex-occidental-life-innovative-solutions'
    FexOccidentalLifePlatinumSolutionLegacyPlan = 'fex-occidental-life-platinum-solution-legacy-plan'
    FexOccidentalLifeSeniorChoice = 'fex-occidental-life-senior-choice'
    FexOccidentalLifeTribute = 'fex-occidental-life-tribute'
    FexOxfordLifeSimplifiedIssue = 'fex-oxford-life-simplified-issue'
    FexPekinWholeLife = 'fex-pekin-whole-life'
    FexPioneerAmericanIndependentAmerican = 'fex-pioneer-american-independent-american'
    FexPioneerAmericanNorthstarLegacy = 'fex-pioneer-american-northstar-legacy'
    FexRoyalArcanumGraded = 'fex-royal-arcanum-graded'
    FexRoyalArcanumSimplifiedIssue = 'fex-royal-arcanum-simplified-issue'
    FexRoyalNeighborsEnsuredLegacy = 'fex-royal-neighbors-ensured-legacy'
    FexSUsaGoldenPromise = 'fex-s.usa-golden-promise'
    FexSbliLivingLegacy = 'fex-sbli-living-legacy'
    FexSecuricoLifeFinalExpense = 'fex-securico-life-final-expense'
    FexSecurityNationalSimpleSecurity = 'fex-security-national-simple-security'
    FexSeniorLifeWholeLife = 'fex-senior-life-whole-life'
    FexSentinelSecurityNewVantage = 'fex-sentinel-security-new-vantage'
    FexSonsOfNorwayLegacySure = 'fex-sons-of-norway-legacy-sure'
    FexSonsOfNorwayWholeLife = 'fex-sons-of-norway-whole-life'
    FexTransamericaFeExpressSolution = 'fex-transamerica-fe-express-solution'
    FexTransamericaSolution = 'fex-transamerica-solution'
    FexTrinityGoldenEagle = 'fex-trinity-golden-eagle'
    FexUnitedFarmAndFamilyWholeLife = 'fex-united-farm-and-family-whole-life'
    FexUnitedHomeLifeWholeLife = 'fex-united-home-life-whole-life'
    MedsupAetnaAccendoMedsup = 'medsup-aetna-accendo-medsup'
    MedsupAetnaMedsup = 'medsup-aetna-medsup'
    MedsupManhattanLifeMedsup = 'medsup-manhattan-life-medsup'
    MedsupMutualOfOmahaMedsup = 'medsup-mutual-of-omaha-medsup'
    PreneedBetterlifeSinglePremium = 'preneed-betterlife-single-premium'
    PreneedGlobalAtlanticSimpleProtectionPlan = 'preneed-global-atlantic-simple-protection-plan'
    TermAmericanAmicableEasyTerm = 'term-american-amicable-easy-term'
    TermAmericanAmicableHomeProtector = 'term-american-amicable-home-protector'
    TermAmericanAmicableTermMadeSimple = 'term-american-amicable-term-made-simple'
    TermAmericoHmsPlus = 'term-americo-hms-plus'
    TermAmeritasFlxLivingBenefitsTerm = 'term-ameritas-flx-living-benefits-term'
    TermAmeritasValuePlusTerm = 'term-ameritas-value-plus-term'
    TermBannerOpterm = 'term-banner-opterm'
    TermCorebridgeSelectATerm = 'term-corebridge-select-a-term'
    TermFidelityLifeInstabrainTerm = 'term-fidelity-life-instabrain-term'
    TermFidelityLifeInstaterm = 'term-fidelity-life-instaterm'
    TermForestersStrongFoundation = 'term-foresters-strong-foundation'
    TermForestersYourTerm = 'term-foresters-your-term'
    TermForestersYourTermNonMedical = 'term-foresters-your-term-non-medical'
    TermGpmQMark = 'term-gpm-q-mark'
    TermGtlTurboTerm = 'term-gtl-turbo-term'
    TermHeroLifeTerm = 'term-hero-life-term'
    TermJohnHancockSimpleTermWithVitality = 'term-john-hancock-simple-term-with-vitality'
    TermKansasCityLifeSignatureTermExpress = 'term-kansas-city-life-signature-term-express'
    TermLincolnLifeelements = 'term-lincoln-lifeelements'
    TermLincolnTermaccel = 'term-lincoln-termaccel'
    TermMutualOfOmahaTermLifeAnswers = 'term-mutual-of-omaha-term-life-answers'
    TermMutualOfOmahaTermLifeExpress = 'term-mutual-of-omaha-term-life-express'
    TermNationwideYourlife = 'term-nationwide-yourlife'
    TermNorthAmericanAddvantage = 'term-north-american-addvantage'
    TermProsperityFamilyFreedomTerm = 'term-prosperity-family-freedom-term'
    TermProtectiveLifeClassicChoiceTerm = 'term-protective-life-classic-choice-term'
    TermProtectiveLifeCustomChoiceTerm = 'term-protective-life-custom-choice-term'
    TermPrudentialEssentialTermPlus = 'term-prudential-essential-term-plus'
    TermPrudentialEssentialTermValue = 'term-prudential-essential-term-value'
    TermSagicorSageTerm = 'term-sagicor-sage-term'
    TermSbliTTerm = 'term-sbli-t-term'
    TermSeniorLifeTermLife = 'term-senior-life-term-life'
    TermTransamericaTrendsetterLb = 'term-transamerica-trendsetter-lb'
    TermTransamericaTrendsetterSuper = 'term-transamerica-trendsetter-super'
    TermWilliamPennOpterm = 'term-william-penn-opterm'


@dataclass(frozen=True, slots=True)
class ProductMetadata:
    """Public metadata for a single ``Product``."""

    slug: str
    display_name: str
    carrier: str
    product_class: str
    ages: tuple[int, int]
    states: tuple[str, ...]
    face_amount: tuple[int, int]
    state_variations: tuple[str, ...]


_METADATA: dict[str, ProductMetadata] = {
    'fex-aetna-accendo': ProductMetadata(slug='fex-aetna-accendo', display_name='Aetna Accendo', carrier='aetna', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple(['Aetna Accendo Montana'])),
    'fex-aetna-protection-series': ProductMetadata(slug='fex-aetna-protection-series', display_name='Aetna Protection Series', carrier='aetna', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-aflac-final-expense': ProductMetadata(slug='fex-aflac-final-expense', display_name='Aflac Final Expense', carrier='aflac', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-amicable-clear-choice': ProductMetadata(slug='fex-american-amicable-clear-choice', display_name='American Amicable Clear Choice', carrier='american-amicable', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-amicable-dignity-solutions': ProductMetadata(slug='fex-american-amicable-dignity-solutions', display_name='American Amicable Dignity Solutions', carrier='american-amicable', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-amicable-golden-solution': ProductMetadata(slug='fex-american-amicable-golden-solution', display_name='American Amicable Golden Solution', carrier='american-amicable', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-amicable-innovative-solutions': ProductMetadata(slug='fex-american-amicable-innovative-solutions', display_name='American Amicable Innovative Solutions', carrier='american-amicable', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-amicable-platinum-solution-legacy-plan': ProductMetadata(slug='fex-american-amicable-platinum-solution-legacy-plan', display_name='American Amicable Platinum Solution Legacy Plan', carrier='american-amicable', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-amicable-senior-choice': ProductMetadata(slug='fex-american-amicable-senior-choice', display_name='American Amicable Senior Choice', carrier='american-amicable', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-amicable-tribute': ProductMetadata(slug='fex-american-amicable-tribute', display_name='American Amicable Tribute', carrier='american-amicable', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-home-life-guidestar': ProductMetadata(slug='fex-american-home-life-guidestar', display_name='American Home Life Guidestar', carrier='american-home-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-american-home-life-patriot-series': ProductMetadata(slug='fex-american-home-life-patriot-series', display_name='American Home Life Patriot Series', carrier='american-home-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-americo-eagle-premier': ProductMetadata(slug='fex-americo-eagle-premier', display_name='Americo Eagle Premier', carrier='americo', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-baltimore-life-iprovide': ProductMetadata(slug='fex-baltimore-life-iprovide', display_name='Baltimore Life iProvide', carrier='baltimore-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-baltimore-life-silver-guard': ProductMetadata(slug='fex-baltimore-life-silver-guard', display_name='Baltimore Life Silver Guard', carrier='baltimore-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-betterlife-final-expense': ProductMetadata(slug='fex-betterlife-final-expense', display_name='BetterLife Final Expense', carrier='betterlife', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-centrian-living-legacy': ProductMetadata(slug='fex-centrian-living-legacy', display_name='Centrian Living Legacy', carrier='centrian', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-cica-life-superior-choice': ProductMetadata(slug='fex-cica-life-superior-choice', display_name='CICA Life Superior Choice', carrier='cica-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-cigna-individual-whole-life': ProductMetadata(slug='fex-cigna-individual-whole-life', display_name='Cigna Individual Whole Life', carrier='cigna', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-combined-generational-life': ProductMetadata(slug='fex-combined-generational-life', display_name='Combined Generational Life', carrier='combined', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-corebridge-giwl': ProductMetadata(slug='fex-corebridge-giwl', display_name='Corebridge GIWL', carrier='corebridge', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-corebridge-simplinow-legacy': ProductMetadata(slug='fex-corebridge-simplinow-legacy', display_name='Corebridge SimpliNow Legacy', carrier='corebridge', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-emc-easylife': ProductMetadata(slug='fex-emc-easylife', display_name='EMC EasyLife', carrier='emc', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-everest-ia-american-advantage-50-plus': ProductMetadata(slug='fex-everest-ia-american-advantage-50-plus', display_name='Everest IA American Advantage 50 Plus', carrier='everest-ia-american', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-family-benefit-life-golden-eagle': ProductMetadata(slug='fex-family-benefit-life-golden-eagle', display_name='Family Benefit Life Golden Eagle', carrier='family-benefit-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-fidelity-life-rapidecision': ProductMetadata(slug='fex-fidelity-life-rapidecision', display_name='Fidelity Life RAPIDecision', carrier='fidelity-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-fidelity-life-rapidecision-senior-life': ProductMetadata(slug='fex-fidelity-life-rapidecision-senior-life', display_name='Fidelity Life RAPIDecision Senior Life', carrier='fidelity-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-first-guaranty-insurance-security-care': ProductMetadata(slug='fex-first-guaranty-insurance-security-care', display_name='First Guaranty Insurance Security Care', carrier='first-guaranty-insurance', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-foresters-plan-right': ProductMetadata(slug='fex-foresters-plan-right', display_name='Foresters Plan Right', carrier='foresters', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-gerber-life': ProductMetadata(slug='fex-gerber-life', display_name='Gerber Life', carrier='gerber', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-gpm-life-secure-mark': ProductMetadata(slug='fex-gpm-life-secure-mark', display_name='GPM Life Secure Mark', carrier='gpm-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-gtl-heritage-plan': ProductMetadata(slug='fex-gtl-heritage-plan', display_name='GTL Heritage Plan', carrier='gtl', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-illinois-mutual-path-protector-plus': ProductMetadata(slug='fex-illinois-mutual-path-protector-plus', display_name='Illinois Mutual Path Protector Plus', carrier='illinois-mutual', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-kskj-final-expense': ProductMetadata(slug='fex-kskj-final-expense', display_name='KSKJ Final Expense', carrier='kskj', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-liberty-bankers-simpl': ProductMetadata(slug='fex-liberty-bankers-simpl', display_name='Liberty Bankers Simpl', carrier='liberty-bankers', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-life-shield-survivor': ProductMetadata(slug='fex-life-shield-survivor', display_name='Life Shield Survivor', carrier='life-shield', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-manhattan-life-secure-advantage': ProductMetadata(slug='fex-manhattan-life-secure-advantage', display_name='Manhattan Life Secure Advantage', carrier='manhattan-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-mutual-of-omaha-living-promise': ProductMetadata(slug='fex-mutual-of-omaha-living-promise', display_name='Mutual of Omaha Living Promise', carrier='mutual-of-omaha', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-newbridge-final-expense': ProductMetadata(slug='fex-newbridge-final-expense', display_name='Newbridge Final Expense', carrier='newbridge', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-occidental-life-clear-choice': ProductMetadata(slug='fex-occidental-life-clear-choice', display_name='Occidental Life Clear Choice', carrier='occidental-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-occidental-life-dignity-solutions': ProductMetadata(slug='fex-occidental-life-dignity-solutions', display_name='Occidental Life Dignity Solutions', carrier='occidental-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-occidental-life-golden-solution': ProductMetadata(slug='fex-occidental-life-golden-solution', display_name='Occidental Life Golden Solution', carrier='occidental-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-occidental-life-innovative-solutions': ProductMetadata(slug='fex-occidental-life-innovative-solutions', display_name='Occidental Life Innovative Solutions', carrier='occidental-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-occidental-life-platinum-solution-legacy-plan': ProductMetadata(slug='fex-occidental-life-platinum-solution-legacy-plan', display_name='Occidental Life Platinum Solution Legacy Plan', carrier='occidental-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-occidental-life-senior-choice': ProductMetadata(slug='fex-occidental-life-senior-choice', display_name='Occidental Life Senior Choice', carrier='occidental-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-occidental-life-tribute': ProductMetadata(slug='fex-occidental-life-tribute', display_name='Occidental Life Tribute', carrier='occidental-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-oxford-life-simplified-issue': ProductMetadata(slug='fex-oxford-life-simplified-issue', display_name='Oxford Life Simplified Issue', carrier='oxford-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-pekin-whole-life': ProductMetadata(slug='fex-pekin-whole-life', display_name='Pekin Whole Life', carrier='pekin', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-pioneer-american-independent-american': ProductMetadata(slug='fex-pioneer-american-independent-american', display_name='Pioneer American Independent American', carrier='pioneer-american', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-pioneer-american-northstar-legacy': ProductMetadata(slug='fex-pioneer-american-northstar-legacy', display_name='Pioneer American NorthStar Legacy', carrier='pioneer-american', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-royal-arcanum-graded': ProductMetadata(slug='fex-royal-arcanum-graded', display_name='Royal Arcanum Graded', carrier='royal-arcanum', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-royal-arcanum-simplified-issue': ProductMetadata(slug='fex-royal-arcanum-simplified-issue', display_name='Royal Arcanum Simplified Issue', carrier='royal-arcanum', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-royal-neighbors-ensured-legacy': ProductMetadata(slug='fex-royal-neighbors-ensured-legacy', display_name='Royal Neighbors Ensured Legacy', carrier='royal-neighbors', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-s.usa-golden-promise': ProductMetadata(slug='fex-s.usa-golden-promise', display_name='S.USA Golden Promise', carrier='s-usa', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-sbli-living-legacy': ProductMetadata(slug='fex-sbli-living-legacy', display_name='SBLI Living Legacy', carrier='sbli', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-securico-life-final-expense': ProductMetadata(slug='fex-securico-life-final-expense', display_name='Securico Life Final Expense', carrier='securico-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-security-national-simple-security': ProductMetadata(slug='fex-security-national-simple-security', display_name='Security National Simple Security', carrier='security-national', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-senior-life-whole-life': ProductMetadata(slug='fex-senior-life-whole-life', display_name='Senior Life Whole Life', carrier='senior-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-sentinel-security-new-vantage': ProductMetadata(slug='fex-sentinel-security-new-vantage', display_name='Sentinel Security New Vantage', carrier='sentinel-security', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-sons-of-norway-legacy-sure': ProductMetadata(slug='fex-sons-of-norway-legacy-sure', display_name='Sons of Norway Legacy Sure', carrier='sons-of-norway', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-sons-of-norway-whole-life': ProductMetadata(slug='fex-sons-of-norway-whole-life', display_name='Sons of Norway Whole Life', carrier='sons-of-norway', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-transamerica-fe-express-solution': ProductMetadata(slug='fex-transamerica-fe-express-solution', display_name='TransAmerica FE Express Solution', carrier='transamerica', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-transamerica-solution': ProductMetadata(slug='fex-transamerica-solution', display_name='TransAmerica Solution', carrier='transamerica', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-trinity-golden-eagle': ProductMetadata(slug='fex-trinity-golden-eagle', display_name='Trinity Golden Eagle', carrier='trinity', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-united-farm-and-family-whole-life': ProductMetadata(slug='fex-united-farm-and-family-whole-life', display_name='United Farm And Family Whole Life', carrier='united-farm-and-family', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'fex-united-home-life-whole-life': ProductMetadata(slug='fex-united-home-life-whole-life', display_name='United Home Life Whole Life', carrier='united-home-life', product_class='fex', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'medsup-aetna-accendo-medsup': ProductMetadata(slug='medsup-aetna-accendo-medsup', display_name='Aetna Accendo Medicare Supplement', carrier='aetna-accendo', product_class='medsup', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'medsup-aetna-medsup': ProductMetadata(slug='medsup-aetna-medsup', display_name='Aetna Medicare Supplement', carrier='aetna', product_class='medsup', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'medsup-manhattan-life-medsup': ProductMetadata(slug='medsup-manhattan-life-medsup', display_name='Manhattan Life Medicare Supplement', carrier='manhattan-life', product_class='medsup', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'medsup-mutual-of-omaha-medsup': ProductMetadata(slug='medsup-mutual-of-omaha-medsup', display_name='Mutual of Omaha Medicare Supplement', carrier='mutual-of-omaha', product_class='medsup', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'preneed-betterlife-single-premium': ProductMetadata(slug='preneed-betterlife-single-premium', display_name='BetterLife Single Premium', carrier='betterlife', product_class='preneed', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'preneed-global-atlantic-simple-protection-plan': ProductMetadata(slug='preneed-global-atlantic-simple-protection-plan', display_name='Global Atlantic Simple Protection Plan', carrier='global-atlantic', product_class='preneed', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-american-amicable-easy-term': ProductMetadata(slug='term-american-amicable-easy-term', display_name='American Amicable Easy Term', carrier='american-amicable', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-american-amicable-home-protector': ProductMetadata(slug='term-american-amicable-home-protector', display_name='American Amicable Home Protector', carrier='american-amicable', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-american-amicable-term-made-simple': ProductMetadata(slug='term-american-amicable-term-made-simple', display_name='American Amicable Term Made Simple', carrier='american-amicable', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-americo-hms-plus': ProductMetadata(slug='term-americo-hms-plus', display_name='Americo HMS PLUS', carrier='americo', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-ameritas-flx-living-benefits-term': ProductMetadata(slug='term-ameritas-flx-living-benefits-term', display_name='Ameritas FLX Living Benefits Term', carrier='ameritas', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-ameritas-value-plus-term': ProductMetadata(slug='term-ameritas-value-plus-term', display_name='Ameritas Value Plus Term', carrier='ameritas', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-banner-opterm': ProductMetadata(slug='term-banner-opterm', display_name='Banner OPTerm', carrier='banner', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-corebridge-select-a-term': ProductMetadata(slug='term-corebridge-select-a-term', display_name='Corebridge Select A Term', carrier='corebridge', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-fidelity-life-instabrain-term': ProductMetadata(slug='term-fidelity-life-instabrain-term', display_name='Fidelity Life InstaBrain Term', carrier='fidelity-life', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-fidelity-life-instaterm': ProductMetadata(slug='term-fidelity-life-instaterm', display_name='Fidelity Life InstaTerm', carrier='fidelity-life', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-foresters-strong-foundation': ProductMetadata(slug='term-foresters-strong-foundation', display_name='Foresters Strong Foundation', carrier='foresters', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-foresters-your-term': ProductMetadata(slug='term-foresters-your-term', display_name='Foresters Your Term', carrier='foresters', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-foresters-your-term-non-medical': ProductMetadata(slug='term-foresters-your-term-non-medical', display_name='Foresters Your Term Non Medical', carrier='foresters', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-gpm-q-mark': ProductMetadata(slug='term-gpm-q-mark', display_name='GPM Q Mark', carrier='gpm', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-gtl-turbo-term': ProductMetadata(slug='term-gtl-turbo-term', display_name='GTL Turbo Term', carrier='gtl', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-hero-life-term': ProductMetadata(slug='term-hero-life-term', display_name='Hero Life Term', carrier='hero-life', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-john-hancock-simple-term-with-vitality': ProductMetadata(slug='term-john-hancock-simple-term-with-vitality', display_name='John Hancock Simple Term with Vitality', carrier='john-hancock', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-kansas-city-life-signature-term-express': ProductMetadata(slug='term-kansas-city-life-signature-term-express', display_name='Kansas City Life Signature Term Express', carrier='kansas-city-life', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-lincoln-lifeelements': ProductMetadata(slug='term-lincoln-lifeelements', display_name='Lincoln LifeElements', carrier='lincoln', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-lincoln-termaccel': ProductMetadata(slug='term-lincoln-termaccel', display_name='Lincoln TermAccel', carrier='lincoln', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-mutual-of-omaha-term-life-answers': ProductMetadata(slug='term-mutual-of-omaha-term-life-answers', display_name='Mutual of Omaha Term Life Answers', carrier='mutual-of-omaha', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-mutual-of-omaha-term-life-express': ProductMetadata(slug='term-mutual-of-omaha-term-life-express', display_name='Mutual of Omaha Term Life Express', carrier='mutual-of-omaha', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-nationwide-yourlife': ProductMetadata(slug='term-nationwide-yourlife', display_name='Nationwide YourLife', carrier='nationwide', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-north-american-addvantage': ProductMetadata(slug='term-north-american-addvantage', display_name='North American ADDvantage', carrier='north-american', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-prosperity-family-freedom-term': ProductMetadata(slug='term-prosperity-family-freedom-term', display_name='Prosperity Family Freedom Term', carrier='prosperity', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-protective-life-classic-choice-term': ProductMetadata(slug='term-protective-life-classic-choice-term', display_name='Protective Life Classic Choice Term', carrier='protective-life', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-protective-life-custom-choice-term': ProductMetadata(slug='term-protective-life-custom-choice-term', display_name='Protective Life Custom Choice Term', carrier='protective-life', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-prudential-essential-term-plus': ProductMetadata(slug='term-prudential-essential-term-plus', display_name='Prudential Essential Term Plus', carrier='prudential', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-prudential-essential-term-value': ProductMetadata(slug='term-prudential-essential-term-value', display_name='Prudential Essential Term Value', carrier='prudential', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-sagicor-sage-term': ProductMetadata(slug='term-sagicor-sage-term', display_name='Sagicor Sage Term', carrier='sagicor', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-sbli-t-term': ProductMetadata(slug='term-sbli-t-term', display_name='SBLI T Term', carrier='sbli', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-senior-life-term-life': ProductMetadata(slug='term-senior-life-term-life', display_name='Senior Life Term Life', carrier='senior-life', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-transamerica-trendsetter-lb': ProductMetadata(slug='term-transamerica-trendsetter-lb', display_name='TransAmerica Trendsetter LB', carrier='transamerica', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-transamerica-trendsetter-super': ProductMetadata(slug='term-transamerica-trendsetter-super', display_name='TransAmerica Trendsetter Super', carrier='transamerica', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
    'term-william-penn-opterm': ProductMetadata(slug='term-william-penn-opterm', display_name='William Penn OPTerm', carrier='william-penn', product_class='term', ages=(0, 0), states=(), face_amount=(0, 0), state_variations=tuple([])),
}

_ALL_PRODUCTS: tuple[Product, ...] = tuple(sorted(Product, key=lambda p: p.value))


def _lc(s: str) -> str:
    return s.lower()


class _ProductsAPI:
    """Catalog API for ``Product``. All methods return frozen, sorted views."""

    __slots__ = ()

    def values(self) -> tuple[Product, ...]:
        """Every product slug. Sorted alphabetically."""
        return _ALL_PRODUCTS

    def entries(self) -> tuple[tuple[Product, ProductMetadata], ...]:
        """``(Product, ProductMetadata)`` pairs in catalog order."""
        return tuple((p, _METADATA[p.value]) for p in _ALL_PRODUCTS)

    def by_carrier(self, carrier: str) -> tuple[Product, ...]:
        """Products filed by a given carrier slug. Case-insensitive match."""
        target = _lc(carrier)
        return tuple(p for p in _ALL_PRODUCTS if _METADATA[p.value].carrier == target)

    def search(self, query: str) -> tuple[Product, ...]:
        """Substring search across slug + display name.

        Returns matches sorted by relevance (prefix matches first, then
        substring matches).
        """
        q = _lc(query.strip())
        if not q:
            return ()
        prefix: list[Product] = []
        substring: list[Product] = []
        for p in _ALL_PRODUCTS:
            m = _METADATA[p.value]
            hay = m.slug + " " + _lc(m.display_name)
            if hay.startswith(q) or _lc(m.display_name).startswith(q):
                prefix.append(p)
            elif q in hay:
                substring.append(p)
        return tuple(prefix + substring)

    def metadata(self, p: Product) -> ProductMetadata:
        """Metadata lookup; raises on unknown slug."""
        m = _METADATA.get(p.value)
        if m is None:
            raise KeyError(f"Products.metadata: unknown product {p.value!r}")
        return m


Products = _ProductsAPI()
