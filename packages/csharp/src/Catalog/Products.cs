// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - insurance/v2_products.json

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Isa.Sdk.Catalog;

/// <summary>
/// A typed product value. Stable across SDK releases inside one wire major.
/// The <see cref="Id"/> (<c>prod_&lt;uuid&gt;</c>) is the only identity: it
/// is the value the v3 prequalify <c>products[]</c> filter matches on.
/// <c>Name</c>, <c>Class</c>, and <c>Carrier</c> are display fields; they
/// may change when a carrier renames a product. Never use them as identifiers.
/// </summary>
/// <param name="Id">Opaque product id (<c>prod_&lt;uuid&gt;</c>). Wire identity for v3 prequalify.</param>
/// <param name="Name">Human-readable product name. Display only; not a stable key.</param>
/// <param name="Class">Product family (<c>fex</c>, <c>term</c>, <c>medsup</c>, <c>preneed</c>).</param>
/// <param name="Carrier">Carrier slug (e.g. <c>aetna</c>). Display only; not a stable key.</param>
public sealed record Product(string Id, string Name, string Class, string Carrier);

/// <summary>
/// Catalog of typed <see cref="Product"/> constants, grouped by product family.
/// Access constants as <c>Products.Fex.AetnaAccendo</c>, etc.
///
/// Reverse lookup by id: <see cref="ById"/> / <see cref="TryById"/>.
/// No slug-based lookup is intentionally provided — slugs are mutable
/// display data and must never be used as identity (see spec rationale).
/// </summary>
public static class Products
{
    /// <summary>Products in the <c>fex</c> family.</summary>
    public static class Fex
    {
        /// <summary>Aetna Accendo.</summary>
        public static readonly Product AetnaAccendo = new Product("prod_d7b57156-3e83-506b-8936-0692c1193dc7", "Aetna Accendo", "fex", "aetna");
        /// <summary>Aetna Protection Series.</summary>
        public static readonly Product AetnaProtectionSeries = new Product("prod_2ebf0de6-7151-59cb-8a3a-745be5255aa0", "Aetna Protection Series", "fex", "aetna");
        /// <summary>Aflac Final Expense.</summary>
        public static readonly Product AflacFinalExpense = new Product("prod_2eaabda5-ea10-5803-b9fd-f92c0261a9c9", "Aflac Final Expense", "fex", "aflac");
        /// <summary>American Amicable Clear Choice.</summary>
        public static readonly Product AmericanAmicableClearChoice = new Product("prod_76ea329c-3e29-539c-9cc4-fe8753bbf8c8", "American Amicable Clear Choice", "fex", "american-amicable");
        /// <summary>American Amicable Dignity Solutions.</summary>
        public static readonly Product AmericanAmicableDignitySolutions = new Product("prod_444bd8e6-1253-5837-9f30-e3e4efe721b2", "American Amicable Dignity Solutions", "fex", "american-amicable");
        /// <summary>American Amicable Golden Solution.</summary>
        public static readonly Product AmericanAmicableGoldenSolution = new Product("prod_b630f531-dd7b-48e2-8f2f-1b03b97ed2f9", "American Amicable Golden Solution", "fex", "american-amicable");
        /// <summary>American Amicable Innovative Solutions.</summary>
        public static readonly Product AmericanAmicableInnovativeSolutions = new Product("prod_1a546f99-9e24-4aec-b80d-99f8a0641230", "American Amicable Innovative Solutions", "fex", "american-amicable");
        /// <summary>American Amicable Platinum Solution Legacy Plan.</summary>
        public static readonly Product AmericanAmicablePlatinumSolutionLegacyPlan = new Product("prod_fbf0beb6-5933-5810-8973-675454c64e54", "American Amicable Platinum Solution Legacy Plan", "fex", "american-amicable");
        /// <summary>American Amicable Senior Choice.</summary>
        public static readonly Product AmericanAmicableSeniorChoice = new Product("prod_6b8e3fdb-79da-4e0c-81f5-534aaca277dd", "American Amicable Senior Choice", "fex", "american-amicable");
        /// <summary>American Amicable Tribute.</summary>
        public static readonly Product AmericanAmicableTribute = new Product("prod_a9725d37-f0c9-429b-94fb-c5c4d1fa1d53", "American Amicable Tribute", "fex", "american-amicable");
        /// <summary>American Home Life Guidestar.</summary>
        public static readonly Product AmericanHomeLifeGuidestar = new Product("prod_9e575f61-4618-53cf-b321-6038b98c4ea5", "American Home Life Guidestar", "fex", "american-home-life");
        /// <summary>American Home Life Patriot Series.</summary>
        public static readonly Product AmericanHomeLifePatriotSeries = new Product("prod_18005d37-9bee-588a-81e6-9f3ba641da35", "American Home Life Patriot Series", "fex", "american-home-life");
        /// <summary>Americo Eagle Premier.</summary>
        public static readonly Product AmericoEaglePremier = new Product("prod_14bbd5ef-adb9-575a-ba14-45da192bc0a3", "Americo Eagle Premier", "fex", "americo");
        /// <summary>Baltimore Life iProvide.</summary>
        public static readonly Product BaltimoreLifeIprovide = new Product("prod_44937aff-cd7f-4484-b6d3-3dc84cd73491", "Baltimore Life iProvide", "fex", "baltimore-life");
        /// <summary>Baltimore Life Silver Guard.</summary>
        public static readonly Product BaltimoreLifeSilverGuard = new Product("prod_4cda675a-9760-51ac-bb70-1e33e83502be", "Baltimore Life Silver Guard", "fex", "baltimore-life");
        /// <summary>BetterLife Final Expense.</summary>
        public static readonly Product BetterlifeFinalExpense = new Product("prod_e0cbd195-3967-5127-b9d7-9d763f9812b9", "BetterLife Final Expense", "fex", "betterlife");
        /// <summary>Centrian Living Legacy.</summary>
        public static readonly Product CentrianLivingLegacy = new Product("prod_ad1bf475-7997-5d4b-9034-bf9d4f0a0494", "Centrian Living Legacy", "fex", "centrian");
        /// <summary>CICA Life Superior Choice.</summary>
        public static readonly Product CicaLifeSuperiorChoice = new Product("prod_0940211a-bc9b-509b-ae1a-6e279eed776b", "CICA Life Superior Choice", "fex", "cica-life");
        /// <summary>Cigna Individual Whole Life.</summary>
        public static readonly Product CignaIndividualWholeLife = new Product("prod_b11f7348-2716-5dae-b588-ed2a54ac4c04", "Cigna Individual Whole Life", "fex", "cigna");
        /// <summary>Combined Generational Life.</summary>
        public static readonly Product CombinedGenerationalLife = new Product("prod_50911138-79a1-4c20-911a-a37a3054e01a", "Combined Generational Life", "fex", "combined");
        /// <summary>Corebridge GIWL.</summary>
        public static readonly Product CorebridgeGiwl = new Product("prod_e49fed5b-0803-480f-9ac4-8774353681ab", "Corebridge GIWL", "fex", "corebridge");
        /// <summary>Corebridge SimpliNow Legacy.</summary>
        public static readonly Product CorebridgeSimplinowLegacy = new Product("prod_7eb671f1-781f-432d-b887-85195902c1cb", "Corebridge SimpliNow Legacy", "fex", "corebridge");
        /// <summary>EMC EasyLife.</summary>
        public static readonly Product EmcEasylife = new Product("prod_e1bda62f-59ba-5770-b4a4-9a3df49243bf", "EMC EasyLife", "fex", "emc");
        /// <summary>Everest IA American Advantage 50 Plus.</summary>
        public static readonly Product EverestIaAmericanAdvantage50Plus = new Product("prod_bb930420-5ed3-5d8a-94f5-a6d9d0571179", "Everest IA American Advantage 50 Plus", "fex", "everest-ia-american");
        /// <summary>Family Benefit Life Golden Eagle.</summary>
        public static readonly Product FamilyBenefitLifeGoldenEagle = new Product("prod_8b224dea-1a89-55ed-8e76-b394d707da1b", "Family Benefit Life Golden Eagle", "fex", "family-benefit-life");
        /// <summary>Fidelity Life RAPIDecision.</summary>
        public static readonly Product FidelityLifeRapidecision = new Product("prod_510ecb6e-5801-53b3-89aa-d578ead5b623", "Fidelity Life RAPIDecision", "fex", "fidelity-life");
        /// <summary>Fidelity Life RAPIDecision Senior Life.</summary>
        public static readonly Product FidelityLifeRapidecisionSeniorLife = new Product("prod_39f74284-c3a3-5ef4-a499-96c80246e57f", "Fidelity Life RAPIDecision Senior Life", "fex", "fidelity-life");
        /// <summary>First Guaranty Insurance Security Care.</summary>
        public static readonly Product FirstGuarantyInsuranceSecurityCare = new Product("prod_f7143a73-aac8-55c7-9f7f-a69462cb5b7e", "First Guaranty Insurance Security Care", "fex", "first-guaranty-insurance");
        /// <summary>Foresters Plan Right.</summary>
        public static readonly Product ForestersPlanRight = new Product("prod_9577974b-a9f3-5da2-9855-1924074044dd", "Foresters Plan Right", "fex", "foresters");
        /// <summary>Gerber Life.</summary>
        public static readonly Product GerberLife = new Product("prod_dc4e84b8-8099-51c9-ae31-37c78c0a8d39", "Gerber Life", "fex", "gerber");
        /// <summary>GPM Life Secure Mark.</summary>
        public static readonly Product GpmLifeSecureMark = new Product("prod_83b78dd8-a77b-558e-9b3b-c9cc5251c613", "GPM Life Secure Mark", "fex", "gpm-life");
        /// <summary>GTL Heritage Plan.</summary>
        public static readonly Product GtlHeritagePlan = new Product("prod_142e101a-749e-4e28-90ea-2f8fed3b6970", "GTL Heritage Plan", "fex", "gtl");
        /// <summary>Illinois Mutual Path Protector Plus.</summary>
        public static readonly Product IllinoisMutualPathProtectorPlus = new Product("prod_e2aea5b2-316d-5150-8504-2e3c2a4e3276", "Illinois Mutual Path Protector Plus", "fex", "illinois-mutual");
        /// <summary>KSKJ Final Expense.</summary>
        public static readonly Product KskjFinalExpense = new Product("prod_d93892e6-0035-5f82-8427-1bd9e49b1959", "KSKJ Final Expense", "fex", "kskj");
        /// <summary>Liberty Bankers Simpl.</summary>
        public static readonly Product LibertyBankersSimpl = new Product("prod_fe3498ec-29a7-5dba-9da9-6a32cb3dc91e", "Liberty Bankers Simpl", "fex", "liberty-bankers");
        /// <summary>Life Shield Survivor.</summary>
        public static readonly Product LifeShieldSurvivor = new Product("prod_d155e90c-cba1-51cf-9d9c-e6518fa13d37", "Life Shield Survivor", "fex", "life-shield");
        /// <summary>Manhattan Life Secure Advantage.</summary>
        public static readonly Product ManhattanLifeSecureAdvantage = new Product("prod_afbfa67e-a41d-45be-bcbc-bf31e7de669f", "Manhattan Life Secure Advantage", "fex", "manhattan-life");
        /// <summary>Mutual of Omaha Living Promise.</summary>
        public static readonly Product MutualOfOmahaLivingPromise = new Product("prod_cb26875d-f5b2-52f7-8f89-66cb3d779bf8", "Mutual of Omaha Living Promise", "fex", "mutual-of-omaha");
        /// <summary>Newbridge Final Expense.</summary>
        public static readonly Product NewbridgeFinalExpense = new Product("prod_007e74bf-671c-41cc-be27-28cfd75fd5d2", "Newbridge Final Expense", "fex", "newbridge");
        /// <summary>Occidental Life Clear Choice.</summary>
        public static readonly Product OccidentalLifeClearChoice = new Product("prod_b06445f5-5e02-5111-863b-5e1260b4524b", "Occidental Life Clear Choice", "fex", "occidental-life");
        /// <summary>Occidental Life Dignity Solutions.</summary>
        public static readonly Product OccidentalLifeDignitySolutions = new Product("prod_07bdd66e-7e3c-5f7f-9c8e-b4bb414dd9e2", "Occidental Life Dignity Solutions", "fex", "occidental-life");
        /// <summary>Occidental Life Golden Solution.</summary>
        public static readonly Product OccidentalLifeGoldenSolution = new Product("prod_d2eeac7e-6aad-5eee-83e1-fd2aee0da64c", "Occidental Life Golden Solution", "fex", "occidental-life");
        /// <summary>Occidental Life Innovative Solutions.</summary>
        public static readonly Product OccidentalLifeInnovativeSolutions = new Product("prod_4b038ed0-2aa2-58e6-9c62-9aa736e4d9b5", "Occidental Life Innovative Solutions", "fex", "occidental-life");
        /// <summary>Occidental Life Platinum Solution Legacy Plan.</summary>
        public static readonly Product OccidentalLifePlatinumSolutionLegacyPlan = new Product("prod_fbd566f8-72f6-5383-84e9-a84c517c8815", "Occidental Life Platinum Solution Legacy Plan", "fex", "occidental-life");
        /// <summary>Occidental Life Senior Choice.</summary>
        public static readonly Product OccidentalLifeSeniorChoice = new Product("prod_97d8f31d-764a-549c-9834-6691e1db06a8", "Occidental Life Senior Choice", "fex", "occidental-life");
        /// <summary>Occidental Life Tribute.</summary>
        public static readonly Product OccidentalLifeTribute = new Product("prod_0c5d1d8d-dd9e-59b8-a5c7-dddfd4b7da1a", "Occidental Life Tribute", "fex", "occidental-life");
        /// <summary>Oxford Life Simplified Issue.</summary>
        public static readonly Product OxfordLifeSimplifiedIssue = new Product("prod_a5a3a129-cf4d-57bf-a278-034b65348c11", "Oxford Life Simplified Issue", "fex", "oxford-life");
        /// <summary>Pekin Whole Life.</summary>
        public static readonly Product PekinWholeLife = new Product("prod_8e946869-fe0e-5f8c-a231-cc1671e4b2d4", "Pekin Whole Life", "fex", "pekin");
        /// <summary>Pioneer American Independent American.</summary>
        public static readonly Product PioneerAmericanIndependentAmerican = new Product("prod_42cfd631-69ea-5711-858d-168503cb0680", "Pioneer American Independent American", "fex", "pioneer-american");
        /// <summary>Pioneer American NorthStar Legacy.</summary>
        public static readonly Product PioneerAmericanNorthstarLegacy = new Product("prod_ec518d73-777d-5976-b4fd-d2e0b6332c56", "Pioneer American NorthStar Legacy", "fex", "pioneer-american");
        /// <summary>Royal Arcanum Graded.</summary>
        public static readonly Product RoyalArcanumGraded = new Product("prod_4d67b7ca-cc86-5849-8e32-5e22bea6cdce", "Royal Arcanum Graded", "fex", "royal-arcanum");
        /// <summary>Royal Arcanum Simplified Issue.</summary>
        public static readonly Product RoyalArcanumSimplifiedIssue = new Product("prod_bf77cdcd-078d-534c-a923-861ce722a0e8", "Royal Arcanum Simplified Issue", "fex", "royal-arcanum");
        /// <summary>Royal Neighbors Ensured Legacy.</summary>
        public static readonly Product RoyalNeighborsEnsuredLegacy = new Product("prod_b039d938-ced2-4496-ad4d-f28b795b8089", "Royal Neighbors Ensured Legacy", "fex", "royal-neighbors");
        /// <summary>S.USA Golden Promise.</summary>
        public static readonly Product SUsaGoldenPromise = new Product("prod_79a26030-6b45-416a-b97d-02e0200a4d39", "S.USA Golden Promise", "fex", "s-usa");
        /// <summary>SBLI Living Legacy.</summary>
        public static readonly Product SbliLivingLegacy = new Product("prod_09b94921-6ba1-5f17-92da-5750c2c0b12a", "SBLI Living Legacy", "fex", "sbli");
        /// <summary>Securico Life Final Expense.</summary>
        public static readonly Product SecuricoLifeFinalExpense = new Product("prod_e2a56a6e-9d28-51d2-893f-b980998b7822", "Securico Life Final Expense", "fex", "securico-life");
        /// <summary>Security National Simple Security.</summary>
        public static readonly Product SecurityNationalSimpleSecurity = new Product("prod_81f01f85-1d97-58b1-9892-f7fd66ac2152", "Security National Simple Security", "fex", "security-national");
        /// <summary>Senior Life Whole Life.</summary>
        public static readonly Product SeniorLifeWholeLife = new Product("prod_ed4476ae-f668-4a64-96cc-d618c1f018b8", "Senior Life Whole Life", "fex", "senior-life");
        /// <summary>Sentinel Security New Vantage.</summary>
        public static readonly Product SentinelSecurityNewVantage = new Product("prod_cac5f3fe-1d7a-5865-84cf-8000ff8bcfd7", "Sentinel Security New Vantage", "fex", "sentinel-security");
        /// <summary>Sons of Norway Legacy Sure.</summary>
        public static readonly Product SonsOfNorwayLegacySure = new Product("prod_2dec8fd4-8ead-4862-a51e-e51f7aae8ee5", "Sons of Norway Legacy Sure", "fex", "sons-of-norway");
        /// <summary>Sons of Norway Whole Life.</summary>
        public static readonly Product SonsOfNorwayWholeLife = new Product("prod_9b00ed35-28a2-4ce6-a50e-914213419d6b", "Sons of Norway Whole Life", "fex", "sons-of-norway");
        /// <summary>TransAmerica FE Express Solution.</summary>
        public static readonly Product TransamericaFeExpressSolution = new Product("prod_18477e53-831f-47bf-829c-0237c23b6fb6", "TransAmerica FE Express Solution", "fex", "transamerica");
        /// <summary>TransAmerica Solution.</summary>
        public static readonly Product TransamericaSolution = new Product("prod_e64af080-608b-5c34-ba46-166d008fa249", "TransAmerica Solution", "fex", "transamerica");
        /// <summary>Trinity Golden Eagle.</summary>
        public static readonly Product TrinityGoldenEagle = new Product("prod_19c56704-7c68-5320-9a8a-042c94ceba64", "Trinity Golden Eagle", "fex", "trinity");
        /// <summary>United Farm And Family Whole Life.</summary>
        public static readonly Product UnitedFarmAndFamilyWholeLife = new Product("prod_a6f48502-08be-5a6b-9934-d3cb3f470972", "United Farm And Family Whole Life", "fex", "united-farm-and-family");
        /// <summary>United Home Life Whole Life.</summary>
        public static readonly Product UnitedHomeLifeWholeLife = new Product("prod_d851aa99-47f9-5400-a966-97a0b5a71bb3", "United Home Life Whole Life", "fex", "united-home-life");
    }

    /// <summary>Products in the <c>medsup</c> family.</summary>
    public static class Medsup
    {
        /// <summary>Aetna Accendo Medicare Supplement.</summary>
        public static readonly Product AetnaAccendoMedsup = new Product("prod_c134cc26-08e2-5489-8e60-8bea89e89f49", "Aetna Accendo Medicare Supplement", "medsup", "aetna-accendo");
        /// <summary>Aetna Medicare Supplement.</summary>
        public static readonly Product AetnaMedsup = new Product("prod_8378b6bc-e99a-5f77-8f0d-cc978560c72f", "Aetna Medicare Supplement", "medsup", "aetna");
        /// <summary>Manhattan Life Medicare Supplement.</summary>
        public static readonly Product ManhattanLifeMedsup = new Product("prod_5ba7fc1f-0bd8-5f49-827a-ca049312920f", "Manhattan Life Medicare Supplement", "medsup", "manhattan-life");
        /// <summary>Mutual of Omaha Medicare Supplement.</summary>
        public static readonly Product MutualOfOmahaMedsup = new Product("prod_88e1ad8f-a3b3-52dd-89b7-8ae7e9d81eca", "Mutual of Omaha Medicare Supplement", "medsup", "mutual-of-omaha");
    }

    /// <summary>Products in the <c>preneed</c> family.</summary>
    public static class Preneed
    {
        /// <summary>BetterLife Single Premium.</summary>
        public static readonly Product BetterlifeSinglePremium = new Product("prod_558a0ca1-c2a3-5007-916d-28dde3eaeabb", "BetterLife Single Premium", "preneed", "betterlife");
        /// <summary>Global Atlantic Simple Protection Plan.</summary>
        public static readonly Product GlobalAtlanticSimpleProtectionPlan = new Product("prod_52d6ba39-47d6-5527-bd4a-49bca391ab19", "Global Atlantic Simple Protection Plan", "preneed", "global-atlantic");
    }

    /// <summary>Products in the <c>term</c> family.</summary>
    public static class Term
    {
        /// <summary>American Amicable Easy Term.</summary>
        public static readonly Product AmericanAmicableEasyTerm = new Product("prod_8bf67d18-391b-51c2-9333-cf557e81d1ff", "American Amicable Easy Term", "term", "american-amicable");
        /// <summary>American Amicable Home Protector.</summary>
        public static readonly Product AmericanAmicableHomeProtector = new Product("prod_7f5a7c56-8ef1-5874-a3c6-6433b4c6c3c4", "American Amicable Home Protector", "term", "american-amicable");
        /// <summary>American Amicable Term Made Simple.</summary>
        public static readonly Product AmericanAmicableTermMadeSimple = new Product("prod_d6147bbb-b210-5422-9ec4-41de0379e552", "American Amicable Term Made Simple", "term", "american-amicable");
        /// <summary>Americo HMS PLUS.</summary>
        public static readonly Product AmericoHmsPlus = new Product("prod_9b379a0d-320e-50ac-bd2e-8519ea503286", "Americo HMS PLUS", "term", "americo");
        /// <summary>Ameritas FLX Living Benefits Term.</summary>
        public static readonly Product AmeritasFlxLivingBenefitsTerm = new Product("prod_e832f26e-f6e6-5009-8c13-d17e5bc6a02f", "Ameritas FLX Living Benefits Term", "term", "ameritas");
        /// <summary>Ameritas Value Plus Term.</summary>
        public static readonly Product AmeritasValuePlusTerm = new Product("prod_6b476015-eeca-5f02-a259-36820bd47b98", "Ameritas Value Plus Term", "term", "ameritas");
        /// <summary>Banner OPTerm.</summary>
        public static readonly Product BannerOpterm = new Product("prod_58edb7da-536d-51d3-8a23-ecb500d37de3", "Banner OPTerm", "term", "banner");
        /// <summary>Corebridge Select A Term.</summary>
        public static readonly Product CorebridgeSelectATerm = new Product("prod_72169acb-1a87-5848-9df0-96454c709b81", "Corebridge Select A Term", "term", "corebridge");
        /// <summary>Fidelity Life InstaBrain Pure Term.</summary>
        public static readonly Product FidelityLifeInstabrainPureTerm = new Product("prod_ddcffff2-12d0-4549-a6af-1eee7d73d646", "Fidelity Life InstaBrain Pure Term", "term", "fidelity-life");
        /// <summary>Fidelity Life InstaBrain Term.</summary>
        public static readonly Product FidelityLifeInstabrainTerm = new Product("prod_10f36326-2bd4-5ae1-8463-e04ad594db6c", "Fidelity Life InstaBrain Term", "term", "fidelity-life");
        /// <summary>Fidelity Life InstaTerm.</summary>
        public static readonly Product FidelityLifeInstaterm = new Product("prod_e1c66430-dec1-571a-b96b-17231fe55c12", "Fidelity Life InstaTerm", "term", "fidelity-life");
        /// <summary>Foresters Strong Foundation.</summary>
        public static readonly Product ForestersStrongFoundation = new Product("prod_797c9cc3-325f-5058-b092-ca811dfd89cf", "Foresters Strong Foundation", "term", "foresters");
        /// <summary>Foresters Your Term.</summary>
        public static readonly Product ForestersYourTerm = new Product("prod_82b87fc0-e3dc-5fb6-bf18-85035e6cb8cf", "Foresters Your Term", "term", "foresters");
        /// <summary>Foresters Your Term Non Medical.</summary>
        public static readonly Product ForestersYourTermNonMedical = new Product("prod_f5c30718-4681-599f-8110-b5aaacd778c7", "Foresters Your Term Non Medical", "term", "foresters");
        /// <summary>GPM Q Mark.</summary>
        public static readonly Product GpmQMark = new Product("prod_bb80c30b-eba4-5319-8ba6-13d807bfba9a", "GPM Q Mark", "term", "gpm");
        /// <summary>GTL Turbo Term.</summary>
        public static readonly Product GtlTurboTerm = new Product("prod_a8249c2b-5277-5113-8ecc-4d8b0f507662", "GTL Turbo Term", "term", "gtl");
        /// <summary>Hero Life Term.</summary>
        public static readonly Product HeroLifeTerm = new Product("prod_7f6016d9-9f12-5f75-a57a-cd16ddffe99c", "Hero Life Term", "term", "hero-life");
        /// <summary>John Hancock Simple Term with Vitality.</summary>
        public static readonly Product JohnHancockSimpleTermWithVitality = new Product("prod_0d293690-3896-530f-a94b-aa2cb72d30bd", "John Hancock Simple Term with Vitality", "term", "john-hancock");
        /// <summary>Kansas City Life Signature Term Express.</summary>
        public static readonly Product KansasCityLifeSignatureTermExpress = new Product("prod_65015b8a-d64d-55f1-9ca1-06588d8b073e", "Kansas City Life Signature Term Express", "term", "kansas-city-life");
        /// <summary>Lincoln LifeElements.</summary>
        public static readonly Product LincolnLifeelements = new Product("prod_9071ccab-2830-59ed-8715-f2330215bf0d", "Lincoln LifeElements", "term", "lincoln");
        /// <summary>Lincoln TermAccel.</summary>
        public static readonly Product LincolnTermaccel = new Product("prod_45751b44-a561-54c2-9e1d-4120fdc09e7f", "Lincoln TermAccel", "term", "lincoln");
        /// <summary>Mutual of Omaha Term Life Answers.</summary>
        public static readonly Product MutualOfOmahaTermLifeAnswers = new Product("prod_ab68ec62-2afe-561c-acd7-dab8eaf56846", "Mutual of Omaha Term Life Answers", "term", "mutual-of-omaha");
        /// <summary>Mutual of Omaha Term Life Express.</summary>
        public static readonly Product MutualOfOmahaTermLifeExpress = new Product("prod_1452309d-291d-54dc-aca7-cc313811a239", "Mutual of Omaha Term Life Express", "term", "mutual-of-omaha");
        /// <summary>Nationwide YourLife.</summary>
        public static readonly Product NationwideYourlife = new Product("prod_f8d141bf-d0b5-5a97-9226-4b1ab5380d47", "Nationwide YourLife", "term", "nationwide");
        /// <summary>North American ADDvantage.</summary>
        public static readonly Product NorthAmericanAddvantage = new Product("prod_29cffca2-ddfc-54de-a94b-65595b68adf3", "North American ADDvantage", "term", "north-american");
        /// <summary>Prosperity Family Freedom Term.</summary>
        public static readonly Product ProsperityFamilyFreedomTerm = new Product("prod_090de60e-d322-55d9-8ef5-a010e5275cc5", "Prosperity Family Freedom Term", "term", "prosperity");
        /// <summary>Protective Life Classic Choice Term.</summary>
        public static readonly Product ProtectiveLifeClassicChoiceTerm = new Product("prod_b11965d0-4866-5e50-b348-d93e09832867", "Protective Life Classic Choice Term", "term", "protective-life");
        /// <summary>Protective Life Custom Choice Term.</summary>
        public static readonly Product ProtectiveLifeCustomChoiceTerm = new Product("prod_6a8bfb0c-15da-51f4-a267-6d237e125d97", "Protective Life Custom Choice Term", "term", "protective-life");
        /// <summary>Prudential Essential Term Plus.</summary>
        public static readonly Product PrudentialEssentialTermPlus = new Product("prod_80952375-cbed-5817-910c-07475af33604", "Prudential Essential Term Plus", "term", "prudential");
        /// <summary>Prudential Essential Term Value.</summary>
        public static readonly Product PrudentialEssentialTermValue = new Product("prod_3d619542-5829-5d2a-9450-6e2673e7cb94", "Prudential Essential Term Value", "term", "prudential");
        /// <summary>Sagicor Sage Term.</summary>
        public static readonly Product SagicorSageTerm = new Product("prod_3a9f8911-2d94-5f27-88b8-62dcc7d5727a", "Sagicor Sage Term", "term", "sagicor");
        /// <summary>SBLI T Term.</summary>
        public static readonly Product SbliTTerm = new Product("prod_360fe967-f7e1-5ab4-8f1a-e56e9ef543ab", "SBLI T Term", "term", "sbli");
        /// <summary>Senior Life Term Life.</summary>
        public static readonly Product SeniorLifeTermLife = new Product("prod_ccebb3f4-2be4-5a64-8365-6e72faf5185d", "Senior Life Term Life", "term", "senior-life");
        /// <summary>TransAmerica Trendsetter LB.</summary>
        public static readonly Product TransamericaTrendsetterLb = new Product("prod_bcfc35ae-30d7-5466-9267-06d09faa3319", "TransAmerica Trendsetter LB", "term", "transamerica");
        /// <summary>TransAmerica Trendsetter Super.</summary>
        public static readonly Product TransamericaTrendsetterSuper = new Product("prod_90d1b5da-5063-56e7-b737-d44b77126da2", "TransAmerica Trendsetter Super", "term", "transamerica");
        /// <summary>William Penn OPTerm.</summary>
        public static readonly Product WilliamPennOpterm = new Product("prod_482585d7-6c1c-5042-b42b-09ef12933d1d", "William Penn OPTerm", "term", "william-penn");
    }

    private static readonly IReadOnlyDictionary<string, Product> BY_ID =
        new ReadOnlyDictionary<string, Product>(new Dictionary<string, Product>(StringComparer.Ordinal)
        {
        ["prod_d7b57156-3e83-506b-8936-0692c1193dc7"] = Fex.AetnaAccendo,
        ["prod_2ebf0de6-7151-59cb-8a3a-745be5255aa0"] = Fex.AetnaProtectionSeries,
        ["prod_2eaabda5-ea10-5803-b9fd-f92c0261a9c9"] = Fex.AflacFinalExpense,
        ["prod_76ea329c-3e29-539c-9cc4-fe8753bbf8c8"] = Fex.AmericanAmicableClearChoice,
        ["prod_444bd8e6-1253-5837-9f30-e3e4efe721b2"] = Fex.AmericanAmicableDignitySolutions,
        ["prod_b630f531-dd7b-48e2-8f2f-1b03b97ed2f9"] = Fex.AmericanAmicableGoldenSolution,
        ["prod_1a546f99-9e24-4aec-b80d-99f8a0641230"] = Fex.AmericanAmicableInnovativeSolutions,
        ["prod_fbf0beb6-5933-5810-8973-675454c64e54"] = Fex.AmericanAmicablePlatinumSolutionLegacyPlan,
        ["prod_6b8e3fdb-79da-4e0c-81f5-534aaca277dd"] = Fex.AmericanAmicableSeniorChoice,
        ["prod_a9725d37-f0c9-429b-94fb-c5c4d1fa1d53"] = Fex.AmericanAmicableTribute,
        ["prod_9e575f61-4618-53cf-b321-6038b98c4ea5"] = Fex.AmericanHomeLifeGuidestar,
        ["prod_18005d37-9bee-588a-81e6-9f3ba641da35"] = Fex.AmericanHomeLifePatriotSeries,
        ["prod_14bbd5ef-adb9-575a-ba14-45da192bc0a3"] = Fex.AmericoEaglePremier,
        ["prod_44937aff-cd7f-4484-b6d3-3dc84cd73491"] = Fex.BaltimoreLifeIprovide,
        ["prod_4cda675a-9760-51ac-bb70-1e33e83502be"] = Fex.BaltimoreLifeSilverGuard,
        ["prod_e0cbd195-3967-5127-b9d7-9d763f9812b9"] = Fex.BetterlifeFinalExpense,
        ["prod_ad1bf475-7997-5d4b-9034-bf9d4f0a0494"] = Fex.CentrianLivingLegacy,
        ["prod_0940211a-bc9b-509b-ae1a-6e279eed776b"] = Fex.CicaLifeSuperiorChoice,
        ["prod_b11f7348-2716-5dae-b588-ed2a54ac4c04"] = Fex.CignaIndividualWholeLife,
        ["prod_50911138-79a1-4c20-911a-a37a3054e01a"] = Fex.CombinedGenerationalLife,
        ["prod_e49fed5b-0803-480f-9ac4-8774353681ab"] = Fex.CorebridgeGiwl,
        ["prod_7eb671f1-781f-432d-b887-85195902c1cb"] = Fex.CorebridgeSimplinowLegacy,
        ["prod_e1bda62f-59ba-5770-b4a4-9a3df49243bf"] = Fex.EmcEasylife,
        ["prod_bb930420-5ed3-5d8a-94f5-a6d9d0571179"] = Fex.EverestIaAmericanAdvantage50Plus,
        ["prod_8b224dea-1a89-55ed-8e76-b394d707da1b"] = Fex.FamilyBenefitLifeGoldenEagle,
        ["prod_510ecb6e-5801-53b3-89aa-d578ead5b623"] = Fex.FidelityLifeRapidecision,
        ["prod_39f74284-c3a3-5ef4-a499-96c80246e57f"] = Fex.FidelityLifeRapidecisionSeniorLife,
        ["prod_f7143a73-aac8-55c7-9f7f-a69462cb5b7e"] = Fex.FirstGuarantyInsuranceSecurityCare,
        ["prod_9577974b-a9f3-5da2-9855-1924074044dd"] = Fex.ForestersPlanRight,
        ["prod_dc4e84b8-8099-51c9-ae31-37c78c0a8d39"] = Fex.GerberLife,
        ["prod_83b78dd8-a77b-558e-9b3b-c9cc5251c613"] = Fex.GpmLifeSecureMark,
        ["prod_142e101a-749e-4e28-90ea-2f8fed3b6970"] = Fex.GtlHeritagePlan,
        ["prod_e2aea5b2-316d-5150-8504-2e3c2a4e3276"] = Fex.IllinoisMutualPathProtectorPlus,
        ["prod_d93892e6-0035-5f82-8427-1bd9e49b1959"] = Fex.KskjFinalExpense,
        ["prod_fe3498ec-29a7-5dba-9da9-6a32cb3dc91e"] = Fex.LibertyBankersSimpl,
        ["prod_d155e90c-cba1-51cf-9d9c-e6518fa13d37"] = Fex.LifeShieldSurvivor,
        ["prod_afbfa67e-a41d-45be-bcbc-bf31e7de669f"] = Fex.ManhattanLifeSecureAdvantage,
        ["prod_cb26875d-f5b2-52f7-8f89-66cb3d779bf8"] = Fex.MutualOfOmahaLivingPromise,
        ["prod_007e74bf-671c-41cc-be27-28cfd75fd5d2"] = Fex.NewbridgeFinalExpense,
        ["prod_b06445f5-5e02-5111-863b-5e1260b4524b"] = Fex.OccidentalLifeClearChoice,
        ["prod_07bdd66e-7e3c-5f7f-9c8e-b4bb414dd9e2"] = Fex.OccidentalLifeDignitySolutions,
        ["prod_d2eeac7e-6aad-5eee-83e1-fd2aee0da64c"] = Fex.OccidentalLifeGoldenSolution,
        ["prod_4b038ed0-2aa2-58e6-9c62-9aa736e4d9b5"] = Fex.OccidentalLifeInnovativeSolutions,
        ["prod_fbd566f8-72f6-5383-84e9-a84c517c8815"] = Fex.OccidentalLifePlatinumSolutionLegacyPlan,
        ["prod_97d8f31d-764a-549c-9834-6691e1db06a8"] = Fex.OccidentalLifeSeniorChoice,
        ["prod_0c5d1d8d-dd9e-59b8-a5c7-dddfd4b7da1a"] = Fex.OccidentalLifeTribute,
        ["prod_a5a3a129-cf4d-57bf-a278-034b65348c11"] = Fex.OxfordLifeSimplifiedIssue,
        ["prod_8e946869-fe0e-5f8c-a231-cc1671e4b2d4"] = Fex.PekinWholeLife,
        ["prod_42cfd631-69ea-5711-858d-168503cb0680"] = Fex.PioneerAmericanIndependentAmerican,
        ["prod_ec518d73-777d-5976-b4fd-d2e0b6332c56"] = Fex.PioneerAmericanNorthstarLegacy,
        ["prod_4d67b7ca-cc86-5849-8e32-5e22bea6cdce"] = Fex.RoyalArcanumGraded,
        ["prod_bf77cdcd-078d-534c-a923-861ce722a0e8"] = Fex.RoyalArcanumSimplifiedIssue,
        ["prod_b039d938-ced2-4496-ad4d-f28b795b8089"] = Fex.RoyalNeighborsEnsuredLegacy,
        ["prod_79a26030-6b45-416a-b97d-02e0200a4d39"] = Fex.SUsaGoldenPromise,
        ["prod_09b94921-6ba1-5f17-92da-5750c2c0b12a"] = Fex.SbliLivingLegacy,
        ["prod_e2a56a6e-9d28-51d2-893f-b980998b7822"] = Fex.SecuricoLifeFinalExpense,
        ["prod_81f01f85-1d97-58b1-9892-f7fd66ac2152"] = Fex.SecurityNationalSimpleSecurity,
        ["prod_ed4476ae-f668-4a64-96cc-d618c1f018b8"] = Fex.SeniorLifeWholeLife,
        ["prod_cac5f3fe-1d7a-5865-84cf-8000ff8bcfd7"] = Fex.SentinelSecurityNewVantage,
        ["prod_2dec8fd4-8ead-4862-a51e-e51f7aae8ee5"] = Fex.SonsOfNorwayLegacySure,
        ["prod_9b00ed35-28a2-4ce6-a50e-914213419d6b"] = Fex.SonsOfNorwayWholeLife,
        ["prod_18477e53-831f-47bf-829c-0237c23b6fb6"] = Fex.TransamericaFeExpressSolution,
        ["prod_e64af080-608b-5c34-ba46-166d008fa249"] = Fex.TransamericaSolution,
        ["prod_19c56704-7c68-5320-9a8a-042c94ceba64"] = Fex.TrinityGoldenEagle,
        ["prod_a6f48502-08be-5a6b-9934-d3cb3f470972"] = Fex.UnitedFarmAndFamilyWholeLife,
        ["prod_d851aa99-47f9-5400-a966-97a0b5a71bb3"] = Fex.UnitedHomeLifeWholeLife,
        ["prod_c134cc26-08e2-5489-8e60-8bea89e89f49"] = Medsup.AetnaAccendoMedsup,
        ["prod_8378b6bc-e99a-5f77-8f0d-cc978560c72f"] = Medsup.AetnaMedsup,
        ["prod_5ba7fc1f-0bd8-5f49-827a-ca049312920f"] = Medsup.ManhattanLifeMedsup,
        ["prod_88e1ad8f-a3b3-52dd-89b7-8ae7e9d81eca"] = Medsup.MutualOfOmahaMedsup,
        ["prod_558a0ca1-c2a3-5007-916d-28dde3eaeabb"] = Preneed.BetterlifeSinglePremium,
        ["prod_52d6ba39-47d6-5527-bd4a-49bca391ab19"] = Preneed.GlobalAtlanticSimpleProtectionPlan,
        ["prod_8bf67d18-391b-51c2-9333-cf557e81d1ff"] = Term.AmericanAmicableEasyTerm,
        ["prod_7f5a7c56-8ef1-5874-a3c6-6433b4c6c3c4"] = Term.AmericanAmicableHomeProtector,
        ["prod_d6147bbb-b210-5422-9ec4-41de0379e552"] = Term.AmericanAmicableTermMadeSimple,
        ["prod_9b379a0d-320e-50ac-bd2e-8519ea503286"] = Term.AmericoHmsPlus,
        ["prod_e832f26e-f6e6-5009-8c13-d17e5bc6a02f"] = Term.AmeritasFlxLivingBenefitsTerm,
        ["prod_6b476015-eeca-5f02-a259-36820bd47b98"] = Term.AmeritasValuePlusTerm,
        ["prod_58edb7da-536d-51d3-8a23-ecb500d37de3"] = Term.BannerOpterm,
        ["prod_72169acb-1a87-5848-9df0-96454c709b81"] = Term.CorebridgeSelectATerm,
        ["prod_ddcffff2-12d0-4549-a6af-1eee7d73d646"] = Term.FidelityLifeInstabrainPureTerm,
        ["prod_10f36326-2bd4-5ae1-8463-e04ad594db6c"] = Term.FidelityLifeInstabrainTerm,
        ["prod_e1c66430-dec1-571a-b96b-17231fe55c12"] = Term.FidelityLifeInstaterm,
        ["prod_797c9cc3-325f-5058-b092-ca811dfd89cf"] = Term.ForestersStrongFoundation,
        ["prod_82b87fc0-e3dc-5fb6-bf18-85035e6cb8cf"] = Term.ForestersYourTerm,
        ["prod_f5c30718-4681-599f-8110-b5aaacd778c7"] = Term.ForestersYourTermNonMedical,
        ["prod_bb80c30b-eba4-5319-8ba6-13d807bfba9a"] = Term.GpmQMark,
        ["prod_a8249c2b-5277-5113-8ecc-4d8b0f507662"] = Term.GtlTurboTerm,
        ["prod_7f6016d9-9f12-5f75-a57a-cd16ddffe99c"] = Term.HeroLifeTerm,
        ["prod_0d293690-3896-530f-a94b-aa2cb72d30bd"] = Term.JohnHancockSimpleTermWithVitality,
        ["prod_65015b8a-d64d-55f1-9ca1-06588d8b073e"] = Term.KansasCityLifeSignatureTermExpress,
        ["prod_9071ccab-2830-59ed-8715-f2330215bf0d"] = Term.LincolnLifeelements,
        ["prod_45751b44-a561-54c2-9e1d-4120fdc09e7f"] = Term.LincolnTermaccel,
        ["prod_ab68ec62-2afe-561c-acd7-dab8eaf56846"] = Term.MutualOfOmahaTermLifeAnswers,
        ["prod_1452309d-291d-54dc-aca7-cc313811a239"] = Term.MutualOfOmahaTermLifeExpress,
        ["prod_f8d141bf-d0b5-5a97-9226-4b1ab5380d47"] = Term.NationwideYourlife,
        ["prod_29cffca2-ddfc-54de-a94b-65595b68adf3"] = Term.NorthAmericanAddvantage,
        ["prod_090de60e-d322-55d9-8ef5-a010e5275cc5"] = Term.ProsperityFamilyFreedomTerm,
        ["prod_b11965d0-4866-5e50-b348-d93e09832867"] = Term.ProtectiveLifeClassicChoiceTerm,
        ["prod_6a8bfb0c-15da-51f4-a267-6d237e125d97"] = Term.ProtectiveLifeCustomChoiceTerm,
        ["prod_80952375-cbed-5817-910c-07475af33604"] = Term.PrudentialEssentialTermPlus,
        ["prod_3d619542-5829-5d2a-9450-6e2673e7cb94"] = Term.PrudentialEssentialTermValue,
        ["prod_3a9f8911-2d94-5f27-88b8-62dcc7d5727a"] = Term.SagicorSageTerm,
        ["prod_360fe967-f7e1-5ab4-8f1a-e56e9ef543ab"] = Term.SbliTTerm,
        ["prod_ccebb3f4-2be4-5a64-8365-6e72faf5185d"] = Term.SeniorLifeTermLife,
        ["prod_bcfc35ae-30d7-5466-9267-06d09faa3319"] = Term.TransamericaTrendsetterLb,
        ["prod_90d1b5da-5063-56e7-b737-d44b77126da2"] = Term.TransamericaTrendsetterSuper,
        ["prod_482585d7-6c1c-5042-b42b-09ef12933d1d"] = Term.WilliamPennOpterm,
        });

    private static readonly Product[] ALL =
    [
        Fex.AetnaAccendo,
        Fex.AetnaProtectionSeries,
        Fex.AflacFinalExpense,
        Fex.AmericanAmicableClearChoice,
        Fex.AmericanAmicableDignitySolutions,
        Fex.AmericanAmicableGoldenSolution,
        Fex.AmericanAmicableInnovativeSolutions,
        Fex.AmericanAmicablePlatinumSolutionLegacyPlan,
        Fex.AmericanAmicableSeniorChoice,
        Fex.AmericanAmicableTribute,
        Fex.AmericanHomeLifeGuidestar,
        Fex.AmericanHomeLifePatriotSeries,
        Fex.AmericoEaglePremier,
        Fex.BaltimoreLifeIprovide,
        Fex.BaltimoreLifeSilverGuard,
        Fex.BetterlifeFinalExpense,
        Fex.CentrianLivingLegacy,
        Fex.CicaLifeSuperiorChoice,
        Fex.CignaIndividualWholeLife,
        Fex.CombinedGenerationalLife,
        Fex.CorebridgeGiwl,
        Fex.CorebridgeSimplinowLegacy,
        Fex.EmcEasylife,
        Fex.EverestIaAmericanAdvantage50Plus,
        Fex.FamilyBenefitLifeGoldenEagle,
        Fex.FidelityLifeRapidecision,
        Fex.FidelityLifeRapidecisionSeniorLife,
        Fex.FirstGuarantyInsuranceSecurityCare,
        Fex.ForestersPlanRight,
        Fex.GerberLife,
        Fex.GpmLifeSecureMark,
        Fex.GtlHeritagePlan,
        Fex.IllinoisMutualPathProtectorPlus,
        Fex.KskjFinalExpense,
        Fex.LibertyBankersSimpl,
        Fex.LifeShieldSurvivor,
        Fex.ManhattanLifeSecureAdvantage,
        Fex.MutualOfOmahaLivingPromise,
        Fex.NewbridgeFinalExpense,
        Fex.OccidentalLifeClearChoice,
        Fex.OccidentalLifeDignitySolutions,
        Fex.OccidentalLifeGoldenSolution,
        Fex.OccidentalLifeInnovativeSolutions,
        Fex.OccidentalLifePlatinumSolutionLegacyPlan,
        Fex.OccidentalLifeSeniorChoice,
        Fex.OccidentalLifeTribute,
        Fex.OxfordLifeSimplifiedIssue,
        Fex.PekinWholeLife,
        Fex.PioneerAmericanIndependentAmerican,
        Fex.PioneerAmericanNorthstarLegacy,
        Fex.RoyalArcanumGraded,
        Fex.RoyalArcanumSimplifiedIssue,
        Fex.RoyalNeighborsEnsuredLegacy,
        Fex.SUsaGoldenPromise,
        Fex.SbliLivingLegacy,
        Fex.SecuricoLifeFinalExpense,
        Fex.SecurityNationalSimpleSecurity,
        Fex.SeniorLifeWholeLife,
        Fex.SentinelSecurityNewVantage,
        Fex.SonsOfNorwayLegacySure,
        Fex.SonsOfNorwayWholeLife,
        Fex.TransamericaFeExpressSolution,
        Fex.TransamericaSolution,
        Fex.TrinityGoldenEagle,
        Fex.UnitedFarmAndFamilyWholeLife,
        Fex.UnitedHomeLifeWholeLife,
        Medsup.AetnaAccendoMedsup,
        Medsup.AetnaMedsup,
        Medsup.ManhattanLifeMedsup,
        Medsup.MutualOfOmahaMedsup,
        Preneed.BetterlifeSinglePremium,
        Preneed.GlobalAtlanticSimpleProtectionPlan,
        Term.AmericanAmicableEasyTerm,
        Term.AmericanAmicableHomeProtector,
        Term.AmericanAmicableTermMadeSimple,
        Term.AmericoHmsPlus,
        Term.AmeritasFlxLivingBenefitsTerm,
        Term.AmeritasValuePlusTerm,
        Term.BannerOpterm,
        Term.CorebridgeSelectATerm,
        Term.FidelityLifeInstabrainPureTerm,
        Term.FidelityLifeInstabrainTerm,
        Term.FidelityLifeInstaterm,
        Term.ForestersStrongFoundation,
        Term.ForestersYourTerm,
        Term.ForestersYourTermNonMedical,
        Term.GpmQMark,
        Term.GtlTurboTerm,
        Term.HeroLifeTerm,
        Term.JohnHancockSimpleTermWithVitality,
        Term.KansasCityLifeSignatureTermExpress,
        Term.LincolnLifeelements,
        Term.LincolnTermaccel,
        Term.MutualOfOmahaTermLifeAnswers,
        Term.MutualOfOmahaTermLifeExpress,
        Term.NationwideYourlife,
        Term.NorthAmericanAddvantage,
        Term.ProsperityFamilyFreedomTerm,
        Term.ProtectiveLifeClassicChoiceTerm,
        Term.ProtectiveLifeCustomChoiceTerm,
        Term.PrudentialEssentialTermPlus,
        Term.PrudentialEssentialTermValue,
        Term.SagicorSageTerm,
        Term.SbliTTerm,
        Term.SeniorLifeTermLife,
        Term.TransamericaTrendsetterLb,
        Term.TransamericaTrendsetterSuper,
        Term.WilliamPennOpterm,
    ];

    /// <summary>
    /// Reverse lookup by opaque product id (<c>prod_&lt;uuid&gt;</c>).
    /// Returns the matching catalog constant, or <c>null</c> when the id is
    /// not present in the catalog. Callers should use this to re-resolve a
    /// stored id into a displayable <see cref="Product"/> at render time.
    /// </summary>
    public static Product? ById(string id)
    {
        if (string.IsNullOrEmpty(id)) return null;
        return BY_ID.TryGetValue(id, out var p) ? p : null;
    }

    /// <summary>
    /// Attempt reverse lookup by opaque product id. Returns <c>true</c> and
    /// sets <paramref name="product"/> when found; <c>false</c> otherwise.
    /// </summary>
    public static bool TryById(string id, out Product? product)
    {
        if (string.IsNullOrEmpty(id)) { product = null; return false; }
        return BY_ID.TryGetValue(id, out product);
    }

    private static readonly IReadOnlyList<Product> ALL_READONLY = Array.AsReadOnly(ALL);

    /// <summary>Every catalog product, in slug order.</summary>
    public static IReadOnlyList<Product> Values() => ALL_READONLY;

    /// <summary>Products filed by a given carrier slug. Case-insensitive match.</summary>
    public static IReadOnlyList<Product> ByCarrier(string carrier)
    {
        if (carrier is null) throw new ArgumentNullException(nameof(carrier));
        var target = carrier.ToLowerInvariant();
        var result = new List<Product>();
        foreach (var p in ALL)
        {
            if (p.Carrier == target) result.Add(p);
        }
        return result.AsReadOnly();
    }

    /// <summary>Substring search across display name. Prefix matches come first.</summary>
    public static IReadOnlyList<Product> Search(string query)
    {
        if (query is null) return Array.Empty<Product>();
        var q = query.Trim().ToLowerInvariant();
        if (q.Length == 0) return Array.Empty<Product>();
        var prefix = new List<Product>();
        var substring = new List<Product>();
        foreach (var p in ALL)
        {
            var name = p.Name.ToLowerInvariant();
            if (name.StartsWith(q, StringComparison.Ordinal))
                prefix.Add(p);
            else if (name.Contains(q))
                substring.Add(p);
        }
        prefix.AddRange(substring);
        return prefix.AsReadOnly();
    }
}
