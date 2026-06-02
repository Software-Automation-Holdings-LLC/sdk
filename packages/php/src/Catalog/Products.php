<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog — do not hand-edit; rerun `php scripts/gen-catalog.php`.
 *
 * Rich, nested, id-carrying product catalog.
 *
 * Usage:
 *
 *     $product = Products::fex()->aetnaAccendo();
 *     $same    = Products::byId($product->id); // identical object
 *
 * `byId` is the only reverse-lookup entry point. There is no `bySlug` on
 * this public surface — slugs are mutable display metadata; ids are stable.
 */
/**
 * Typed accessor for the `fex` product family.
 * Obtain via {@see Products::fex()}.
 */
final class FexProducts
{
    public function aetnaAccendo(): Product
    {
        return new Product(id: 'prod_d7b57156-3e83-506b-8936-0692c1193dc7', name: 'Aetna Accendo', class: 'fex', carrier: 'Aetna');
    }

    public function aetnaProtectionSeries(): Product
    {
        return new Product(id: 'prod_2ebf0de6-7151-59cb-8a3a-745be5255aa0', name: 'Aetna Protection Series', class: 'fex', carrier: 'Aetna');
    }

    public function aflacFinalExpense(): Product
    {
        return new Product(id: 'prod_2eaabda5-ea10-5803-b9fd-f92c0261a9c9', name: 'Aflac Final Expense', class: 'fex', carrier: 'Aflac');
    }

    public function americanAmicableClearChoice(): Product
    {
        return new Product(id: 'prod_76ea329c-3e29-539c-9cc4-fe8753bbf8c8', name: 'American Amicable Clear Choice', class: 'fex', carrier: 'American Amicable');
    }

    public function americanAmicableDignitySolutions(): Product
    {
        return new Product(id: 'prod_444bd8e6-1253-5837-9f30-e3e4efe721b2', name: 'American Amicable Dignity Solutions', class: 'fex', carrier: 'American Amicable');
    }

    public function americanAmicableGoldenSolution(): Product
    {
        return new Product(id: 'prod_b630f531-dd7b-48e2-8f2f-1b03b97ed2f9', name: 'American Amicable Golden Solution', class: 'fex', carrier: 'American Amicable');
    }

    public function americanAmicableInnovativeSolutions(): Product
    {
        return new Product(id: 'prod_1a546f99-9e24-4aec-b80d-99f8a0641230', name: 'American Amicable Innovative Solutions', class: 'fex', carrier: 'American Amicable');
    }

    public function americanAmicablePlatinumSolutionLegacyPlan(): Product
    {
        return new Product(id: 'prod_fbf0beb6-5933-5810-8973-675454c64e54', name: 'American Amicable Platinum Solution Legacy Plan', class: 'fex', carrier: 'American Amicable');
    }

    public function americanAmicableSeniorChoice(): Product
    {
        return new Product(id: 'prod_6b8e3fdb-79da-4e0c-81f5-534aaca277dd', name: 'American Amicable Senior Choice', class: 'fex', carrier: 'American Amicable');
    }

    public function americanAmicableTribute(): Product
    {
        return new Product(id: 'prod_a9725d37-f0c9-429b-94fb-c5c4d1fa1d53', name: 'American Amicable Tribute', class: 'fex', carrier: 'American Amicable');
    }

    public function americanHomeLifeGuidestar(): Product
    {
        return new Product(id: 'prod_9e575f61-4618-53cf-b321-6038b98c4ea5', name: 'American Home Life Guidestar', class: 'fex', carrier: 'American Home Life');
    }

    public function americanHomeLifePatriotSeries(): Product
    {
        return new Product(id: 'prod_18005d37-9bee-588a-81e6-9f3ba641da35', name: 'American Home Life Patriot Series', class: 'fex', carrier: 'American Home Life');
    }

    public function americoEaglePremier(): Product
    {
        return new Product(id: 'prod_14bbd5ef-adb9-575a-ba14-45da192bc0a3', name: 'Americo Eagle Premier', class: 'fex', carrier: 'Americo');
    }

    public function baltimoreLifeSilverGuard(): Product
    {
        return new Product(id: 'prod_4cda675a-9760-51ac-bb70-1e33e83502be', name: 'Baltimore Life Silver Guard', class: 'fex', carrier: 'Baltimore Life');
    }

    public function baltimoreLifeIprovide(): Product
    {
        return new Product(id: 'prod_44937aff-cd7f-4484-b6d3-3dc84cd73491', name: 'Baltimore Life iProvide', class: 'fex', carrier: 'Baltimore Life');
    }

    public function betterlifeFinalExpense(): Product
    {
        return new Product(id: 'prod_e0cbd195-3967-5127-b9d7-9d763f9812b9', name: 'BetterLife Final Expense', class: 'fex', carrier: 'BetterLife');
    }

    public function cicaLifeSuperiorChoice(): Product
    {
        return new Product(id: 'prod_0940211a-bc9b-509b-ae1a-6e279eed776b', name: 'CICA Life Superior Choice', class: 'fex', carrier: 'CICA Life');
    }

    public function centrianLivingLegacy(): Product
    {
        return new Product(id: 'prod_ad1bf475-7997-5d4b-9034-bf9d4f0a0494', name: 'Centrian Living Legacy', class: 'fex', carrier: 'Centrian');
    }

    public function cignaIndividualWholeLife(): Product
    {
        return new Product(id: 'prod_b11f7348-2716-5dae-b588-ed2a54ac4c04', name: 'Cigna Individual Whole Life', class: 'fex', carrier: 'Cigna');
    }

    public function combinedGenerationalLife(): Product
    {
        return new Product(id: 'prod_50911138-79a1-4c20-911a-a37a3054e01a', name: 'Combined Generational Life', class: 'fex', carrier: 'Combined');
    }

    public function corebridgeGiwl(): Product
    {
        return new Product(id: 'prod_e49fed5b-0803-480f-9ac4-8774353681ab', name: 'Corebridge GIWL', class: 'fex', carrier: 'Corebridge');
    }

    public function corebridgeSimplinowLegacy(): Product
    {
        return new Product(id: 'prod_7eb671f1-781f-432d-b887-85195902c1cb', name: 'Corebridge SimpliNow Legacy', class: 'fex', carrier: 'Corebridge');
    }

    public function emcEasylife(): Product
    {
        return new Product(id: 'prod_e1bda62f-59ba-5770-b4a4-9a3df49243bf', name: 'EMC EasyLife', class: 'fex', carrier: 'EMC');
    }

    public function everestIaAmericanAdvantage50Plus(): Product
    {
        return new Product(id: 'prod_bb930420-5ed3-5d8a-94f5-a6d9d0571179', name: 'Everest IA American Advantage 50 Plus', class: 'fex', carrier: 'Everest IA American');
    }

    public function familyBenefitLifeGoldenEagle(): Product
    {
        return new Product(id: 'prod_8b224dea-1a89-55ed-8e76-b394d707da1b', name: 'Family Benefit Life Golden Eagle', class: 'fex', carrier: 'Family Benefit Life');
    }

    public function fidelityLifeRapidecision(): Product
    {
        return new Product(id: 'prod_510ecb6e-5801-53b3-89aa-d578ead5b623', name: 'Fidelity Life RAPIDecision', class: 'fex', carrier: 'Fidelity Life');
    }

    public function fidelityLifeRapidecisionSeniorLife(): Product
    {
        return new Product(id: 'prod_39f74284-c3a3-5ef4-a499-96c80246e57f', name: 'Fidelity Life RAPIDecision Senior Life', class: 'fex', carrier: 'Fidelity Life');
    }

    public function firstGuarantyInsuranceSecurityCare(): Product
    {
        return new Product(id: 'prod_f7143a73-aac8-55c7-9f7f-a69462cb5b7e', name: 'First Guaranty Insurance Security Care', class: 'fex', carrier: 'First Guaranty Insurance');
    }

    public function forestersPlanRight(): Product
    {
        return new Product(id: 'prod_9577974b-a9f3-5da2-9855-1924074044dd', name: 'Foresters Plan Right', class: 'fex', carrier: 'Foresters');
    }

    public function gpmLifeSecureMark(): Product
    {
        return new Product(id: 'prod_83b78dd8-a77b-558e-9b3b-c9cc5251c613', name: 'GPM Life Secure Mark', class: 'fex', carrier: 'GPM Life');
    }

    public function gtlHeritagePlan(): Product
    {
        return new Product(id: 'prod_142e101a-749e-4e28-90ea-2f8fed3b6970', name: 'GTL Heritage Plan', class: 'fex', carrier: 'GTL');
    }

    public function gerberLife(): Product
    {
        return new Product(id: 'prod_dc4e84b8-8099-51c9-ae31-37c78c0a8d39', name: 'Gerber Life', class: 'fex', carrier: 'Gerber');
    }

    public function illinoisMutualPathProtectorPlus(): Product
    {
        return new Product(id: 'prod_e2aea5b2-316d-5150-8504-2e3c2a4e3276', name: 'Illinois Mutual Path Protector Plus', class: 'fex', carrier: 'Illinois Mutual');
    }

    public function kskjFinalExpense(): Product
    {
        return new Product(id: 'prod_d93892e6-0035-5f82-8427-1bd9e49b1959', name: 'KSKJ Final Expense', class: 'fex', carrier: 'KSKJ');
    }

    public function libertyBankersSimpl(): Product
    {
        return new Product(id: 'prod_fe3498ec-29a7-5dba-9da9-6a32cb3dc91e', name: 'Liberty Bankers Simpl', class: 'fex', carrier: 'Liberty Bankers');
    }

    public function lifeShieldSurvivor(): Product
    {
        return new Product(id: 'prod_d155e90c-cba1-51cf-9d9c-e6518fa13d37', name: 'Life Shield Survivor', class: 'fex', carrier: 'Life Shield');
    }

    public function manhattanLifeSecureAdvantage(): Product
    {
        return new Product(id: 'prod_afbfa67e-a41d-45be-bcbc-bf31e7de669f', name: 'Manhattan Life Secure Advantage', class: 'fex', carrier: 'Manhattan Life');
    }

    public function mutualOfOmahaLivingPromise(): Product
    {
        return new Product(id: 'prod_cb26875d-f5b2-52f7-8f89-66cb3d779bf8', name: 'Mutual of Omaha Living Promise', class: 'fex', carrier: 'Mutual of Omaha');
    }

    public function newbridgeFinalExpense(): Product
    {
        return new Product(id: 'prod_007e74bf-671c-41cc-be27-28cfd75fd5d2', name: 'Newbridge Final Expense', class: 'fex', carrier: 'Newbridge');
    }

    public function occidentalLifeClearChoice(): Product
    {
        return new Product(id: 'prod_b06445f5-5e02-5111-863b-5e1260b4524b', name: 'Occidental Life Clear Choice', class: 'fex', carrier: 'Occidental Life');
    }

    public function occidentalLifeDignitySolutions(): Product
    {
        return new Product(id: 'prod_07bdd66e-7e3c-5f7f-9c8e-b4bb414dd9e2', name: 'Occidental Life Dignity Solutions', class: 'fex', carrier: 'Occidental Life');
    }

    public function occidentalLifeGoldenSolution(): Product
    {
        return new Product(id: 'prod_d2eeac7e-6aad-5eee-83e1-fd2aee0da64c', name: 'Occidental Life Golden Solution', class: 'fex', carrier: 'Occidental Life');
    }

    public function occidentalLifeInnovativeSolutions(): Product
    {
        return new Product(id: 'prod_4b038ed0-2aa2-58e6-9c62-9aa736e4d9b5', name: 'Occidental Life Innovative Solutions', class: 'fex', carrier: 'Occidental Life');
    }

    public function occidentalLifePlatinumSolutionLegacyPlan(): Product
    {
        return new Product(id: 'prod_fbd566f8-72f6-5383-84e9-a84c517c8815', name: 'Occidental Life Platinum Solution Legacy Plan', class: 'fex', carrier: 'Occidental Life');
    }

    public function occidentalLifeSeniorChoice(): Product
    {
        return new Product(id: 'prod_97d8f31d-764a-549c-9834-6691e1db06a8', name: 'Occidental Life Senior Choice', class: 'fex', carrier: 'Occidental Life');
    }

    public function occidentalLifeTribute(): Product
    {
        return new Product(id: 'prod_0c5d1d8d-dd9e-59b8-a5c7-dddfd4b7da1a', name: 'Occidental Life Tribute', class: 'fex', carrier: 'Occidental Life');
    }

    public function oxfordLifeSimplifiedIssue(): Product
    {
        return new Product(id: 'prod_a5a3a129-cf4d-57bf-a278-034b65348c11', name: 'Oxford Life Simplified Issue', class: 'fex', carrier: 'Oxford Life');
    }

    public function pekinWholeLife(): Product
    {
        return new Product(id: 'prod_8e946869-fe0e-5f8c-a231-cc1671e4b2d4', name: 'Pekin Whole Life', class: 'fex', carrier: 'Pekin');
    }

    public function pioneerAmericanIndependentAmerican(): Product
    {
        return new Product(id: 'prod_42cfd631-69ea-5711-858d-168503cb0680', name: 'Pioneer American Independent American', class: 'fex', carrier: 'Pioneer American');
    }

    public function pioneerAmericanNorthstarLegacy(): Product
    {
        return new Product(id: 'prod_ec518d73-777d-5976-b4fd-d2e0b6332c56', name: 'Pioneer American NorthStar Legacy', class: 'fex', carrier: 'Pioneer American');
    }

    public function royalArcanumGraded(): Product
    {
        return new Product(id: 'prod_4d67b7ca-cc86-5849-8e32-5e22bea6cdce', name: 'Royal Arcanum Graded', class: 'fex', carrier: 'Royal Arcanum');
    }

    public function royalArcanumSimplifiedIssue(): Product
    {
        return new Product(id: 'prod_bf77cdcd-078d-534c-a923-861ce722a0e8', name: 'Royal Arcanum Simplified Issue', class: 'fex', carrier: 'Royal Arcanum');
    }

    public function royalNeighborsEnsuredLegacy(): Product
    {
        return new Product(id: 'prod_b039d938-ced2-4496-ad4d-f28b795b8089', name: 'Royal Neighbors Ensured Legacy', class: 'fex', carrier: 'Royal Neighbors');
    }

    public function sUsaGoldenPromise(): Product
    {
        return new Product(id: 'prod_79a26030-6b45-416a-b97d-02e0200a4d39', name: 'S.USA Golden Promise', class: 'fex', carrier: 'S.USA');
    }

    public function sbliLivingLegacy(): Product
    {
        return new Product(id: 'prod_09b94921-6ba1-5f17-92da-5750c2c0b12a', name: 'SBLI Living Legacy', class: 'fex', carrier: 'SBLI');
    }

    public function securicoLifeFinalExpense(): Product
    {
        return new Product(id: 'prod_e2a56a6e-9d28-51d2-893f-b980998b7822', name: 'Securico Life Final Expense', class: 'fex', carrier: 'Securico Life');
    }

    public function securityNationalSimpleSecurity(): Product
    {
        return new Product(id: 'prod_81f01f85-1d97-58b1-9892-f7fd66ac2152', name: 'Security National Simple Security', class: 'fex', carrier: 'Security National');
    }

    public function seniorLifeWholeLife(): Product
    {
        return new Product(id: 'prod_ed4476ae-f668-4a64-96cc-d618c1f018b8', name: 'Senior Life Whole Life', class: 'fex', carrier: 'Senior Life');
    }

    public function sentinelSecurityNewVantage(): Product
    {
        return new Product(id: 'prod_cac5f3fe-1d7a-5865-84cf-8000ff8bcfd7', name: 'Sentinel Security New Vantage', class: 'fex', carrier: 'Sentinel Security');
    }

    public function sonsOfNorwayLegacySure(): Product
    {
        return new Product(id: 'prod_2dec8fd4-8ead-4862-a51e-e51f7aae8ee5', name: 'Sons of Norway Legacy Sure', class: 'fex', carrier: 'Sons of Norway');
    }

    public function sonsOfNorwayWholeLife(): Product
    {
        return new Product(id: 'prod_9b00ed35-28a2-4ce6-a50e-914213419d6b', name: 'Sons of Norway Whole Life', class: 'fex', carrier: 'Sons of Norway');
    }

    public function transamericaFeExpressSolution(): Product
    {
        return new Product(id: 'prod_18477e53-831f-47bf-829c-0237c23b6fb6', name: 'TransAmerica FE Express Solution', class: 'fex', carrier: 'TransAmerica');
    }

    public function transamericaSolution(): Product
    {
        return new Product(id: 'prod_e64af080-608b-5c34-ba46-166d008fa249', name: 'TransAmerica Solution', class: 'fex', carrier: 'TransAmerica');
    }

    public function trinityGoldenEagle(): Product
    {
        return new Product(id: 'prod_19c56704-7c68-5320-9a8a-042c94ceba64', name: 'Trinity Golden Eagle', class: 'fex', carrier: 'Trinity');
    }

    public function unitedFarmAndFamilyWholeLife(): Product
    {
        return new Product(id: 'prod_a6f48502-08be-5a6b-9934-d3cb3f470972', name: 'United Farm And Family Whole Life', class: 'fex', carrier: 'United Farm And Family');
    }

    public function unitedHomeLifeWholeLife(): Product
    {
        return new Product(id: 'prod_d851aa99-47f9-5400-a966-97a0b5a71bb3', name: 'United Home Life Whole Life', class: 'fex', carrier: 'United Home Life');
    }
    private function __construct() {}

    /** @internal */
    public static function instance(): self { return new self(); }
}

/**
 * Typed accessor for the `term` product family.
 * Obtain via {@see Products::term()}.
 */
final class TermProducts
{
    public function americanAmicableEasyTerm(): Product
    {
        return new Product(id: 'prod_8bf67d18-391b-51c2-9333-cf557e81d1ff', name: 'American Amicable Easy Term', class: 'term', carrier: 'American Amicable');
    }

    public function americanAmicableHomeProtector(): Product
    {
        return new Product(id: 'prod_7f5a7c56-8ef1-5874-a3c6-6433b4c6c3c4', name: 'American Amicable Home Protector', class: 'term', carrier: 'American Amicable');
    }

    public function americanAmicableTermMadeSimple(): Product
    {
        return new Product(id: 'prod_d6147bbb-b210-5422-9ec4-41de0379e552', name: 'American Amicable Term Made Simple', class: 'term', carrier: 'American Amicable');
    }

    public function americoHmsPlus(): Product
    {
        return new Product(id: 'prod_9b379a0d-320e-50ac-bd2e-8519ea503286', name: 'Americo HMS PLUS', class: 'term', carrier: 'Americo');
    }

    public function ameritasFlxLivingBenefitsTerm(): Product
    {
        return new Product(id: 'prod_e832f26e-f6e6-5009-8c13-d17e5bc6a02f', name: 'Ameritas FLX Living Benefits Term', class: 'term', carrier: 'Ameritas');
    }

    public function ameritasValuePlusTerm(): Product
    {
        return new Product(id: 'prod_6b476015-eeca-5f02-a259-36820bd47b98', name: 'Ameritas Value Plus Term', class: 'term', carrier: 'Ameritas');
    }

    public function bannerOpterm(): Product
    {
        return new Product(id: 'prod_58edb7da-536d-51d3-8a23-ecb500d37de3', name: 'Banner OPTerm', class: 'term', carrier: 'Banner');
    }

    public function corebridgeSelectATerm(): Product
    {
        return new Product(id: 'prod_72169acb-1a87-5848-9df0-96454c709b81', name: 'Corebridge Select A Term', class: 'term', carrier: 'Corebridge');
    }

    public function fidelityLifeInstabrainPureTerm(): Product
    {
        return new Product(id: 'prod_ddcffff2-12d0-4549-a6af-1eee7d73d646', name: 'Fidelity Life InstaBrain Pure Term', class: 'term', carrier: 'Fidelity Life');
    }

    public function fidelityLifeInstabrainTerm(): Product
    {
        return new Product(id: 'prod_10f36326-2bd4-5ae1-8463-e04ad594db6c', name: 'Fidelity Life InstaBrain Term', class: 'term', carrier: 'Fidelity Life');
    }

    public function fidelityLifeInstaterm(): Product
    {
        return new Product(id: 'prod_e1c66430-dec1-571a-b96b-17231fe55c12', name: 'Fidelity Life InstaTerm', class: 'term', carrier: 'Fidelity Life');
    }

    public function forestersStrongFoundation(): Product
    {
        return new Product(id: 'prod_797c9cc3-325f-5058-b092-ca811dfd89cf', name: 'Foresters Strong Foundation', class: 'term', carrier: 'Foresters');
    }

    public function forestersYourTerm(): Product
    {
        return new Product(id: 'prod_82b87fc0-e3dc-5fb6-bf18-85035e6cb8cf', name: 'Foresters Your Term', class: 'term', carrier: 'Foresters');
    }

    public function forestersYourTermNonMedical(): Product
    {
        return new Product(id: 'prod_f5c30718-4681-599f-8110-b5aaacd778c7', name: 'Foresters Your Term Non Medical', class: 'term', carrier: 'Foresters');
    }

    public function gpmQMark(): Product
    {
        return new Product(id: 'prod_bb80c30b-eba4-5319-8ba6-13d807bfba9a', name: 'GPM Q Mark', class: 'term', carrier: 'GPM');
    }

    public function gtlTurboTerm(): Product
    {
        return new Product(id: 'prod_a8249c2b-5277-5113-8ecc-4d8b0f507662', name: 'GTL Turbo Term', class: 'term', carrier: 'GTL');
    }

    public function heroLifeTerm(): Product
    {
        return new Product(id: 'prod_7f6016d9-9f12-5f75-a57a-cd16ddffe99c', name: 'Hero Life Term', class: 'term', carrier: 'Hero Life');
    }

    public function johnHancockSimpleTermWithVitality(): Product
    {
        return new Product(id: 'prod_0d293690-3896-530f-a94b-aa2cb72d30bd', name: 'John Hancock Simple Term with Vitality', class: 'term', carrier: 'John Hancock');
    }

    public function kansasCityLifeSignatureTermExpress(): Product
    {
        return new Product(id: 'prod_65015b8a-d64d-55f1-9ca1-06588d8b073e', name: 'Kansas City Life Signature Term Express', class: 'term', carrier: 'Kansas City Life');
    }

    public function lincolnLifeelements(): Product
    {
        return new Product(id: 'prod_9071ccab-2830-59ed-8715-f2330215bf0d', name: 'Lincoln LifeElements', class: 'term', carrier: 'Lincoln');
    }

    public function lincolnTermaccel(): Product
    {
        return new Product(id: 'prod_45751b44-a561-54c2-9e1d-4120fdc09e7f', name: 'Lincoln TermAccel', class: 'term', carrier: 'Lincoln');
    }

    public function mutualOfOmahaTermLifeAnswers(): Product
    {
        return new Product(id: 'prod_ab68ec62-2afe-561c-acd7-dab8eaf56846', name: 'Mutual of Omaha Term Life Answers', class: 'term', carrier: 'Mutual of Omaha');
    }

    public function mutualOfOmahaTermLifeExpress(): Product
    {
        return new Product(id: 'prod_1452309d-291d-54dc-aca7-cc313811a239', name: 'Mutual of Omaha Term Life Express', class: 'term', carrier: 'Mutual of Omaha');
    }

    public function nationwideYourlife(): Product
    {
        return new Product(id: 'prod_f8d141bf-d0b5-5a97-9226-4b1ab5380d47', name: 'Nationwide YourLife', class: 'term', carrier: 'Nationwide');
    }

    public function northAmericanAddvantage(): Product
    {
        return new Product(id: 'prod_29cffca2-ddfc-54de-a94b-65595b68adf3', name: 'North American ADDvantage', class: 'term', carrier: 'North American');
    }

    public function prosperityFamilyFreedomTerm(): Product
    {
        return new Product(id: 'prod_090de60e-d322-55d9-8ef5-a010e5275cc5', name: 'Prosperity Family Freedom Term', class: 'term', carrier: 'Prosperity');
    }

    public function protectiveLifeClassicChoiceTerm(): Product
    {
        return new Product(id: 'prod_b11965d0-4866-5e50-b348-d93e09832867', name: 'Protective Life Classic Choice Term', class: 'term', carrier: 'Protective Life');
    }

    public function protectiveLifeCustomChoiceTerm(): Product
    {
        return new Product(id: 'prod_6a8bfb0c-15da-51f4-a267-6d237e125d97', name: 'Protective Life Custom Choice Term', class: 'term', carrier: 'Protective Life');
    }

    public function prudentialEssentialTermPlus(): Product
    {
        return new Product(id: 'prod_80952375-cbed-5817-910c-07475af33604', name: 'Prudential Essential Term Plus', class: 'term', carrier: 'Prudential');
    }

    public function prudentialEssentialTermValue(): Product
    {
        return new Product(id: 'prod_3d619542-5829-5d2a-9450-6e2673e7cb94', name: 'Prudential Essential Term Value', class: 'term', carrier: 'Prudential');
    }

    public function sbliTTerm(): Product
    {
        return new Product(id: 'prod_360fe967-f7e1-5ab4-8f1a-e56e9ef543ab', name: 'SBLI T Term', class: 'term', carrier: 'SBLI');
    }

    public function sagicorSageTerm(): Product
    {
        return new Product(id: 'prod_3a9f8911-2d94-5f27-88b8-62dcc7d5727a', name: 'Sagicor Sage Term', class: 'term', carrier: 'Sagicor');
    }

    public function seniorLifeTermLife(): Product
    {
        return new Product(id: 'prod_ccebb3f4-2be4-5a64-8365-6e72faf5185d', name: 'Senior Life Term Life', class: 'term', carrier: 'Senior Life');
    }

    public function transamericaTrendsetterLb(): Product
    {
        return new Product(id: 'prod_bcfc35ae-30d7-5466-9267-06d09faa3319', name: 'TransAmerica Trendsetter LB', class: 'term', carrier: 'TransAmerica');
    }

    public function transamericaTrendsetterSuper(): Product
    {
        return new Product(id: 'prod_90d1b5da-5063-56e7-b737-d44b77126da2', name: 'TransAmerica Trendsetter Super', class: 'term', carrier: 'TransAmerica');
    }

    public function williamPennOpterm(): Product
    {
        return new Product(id: 'prod_482585d7-6c1c-5042-b42b-09ef12933d1d', name: 'William Penn OPTerm', class: 'term', carrier: 'William Penn');
    }
    private function __construct() {}

    /** @internal */
    public static function instance(): self { return new self(); }
}

/**
 * Typed accessor for the `medsup` product family.
 * Obtain via {@see Products::medsup()}.
 */
final class MedsupProducts
{
    public function aetnaAccendoMedicareSupplement(): Product
    {
        return new Product(id: 'prod_c134cc26-08e2-5489-8e60-8bea89e89f49', name: 'Aetna Accendo Medicare Supplement', class: 'medsup', carrier: 'Aetna Accendo');
    }

    public function aetnaMedicareSupplement(): Product
    {
        return new Product(id: 'prod_8378b6bc-e99a-5f77-8f0d-cc978560c72f', name: 'Aetna Medicare Supplement', class: 'medsup', carrier: 'Aetna');
    }

    public function manhattanLifeMedicareSupplement(): Product
    {
        return new Product(id: 'prod_5ba7fc1f-0bd8-5f49-827a-ca049312920f', name: 'Manhattan Life Medicare Supplement', class: 'medsup', carrier: 'Manhattan Life');
    }

    public function mutualOfOmahaMedicareSupplement(): Product
    {
        return new Product(id: 'prod_88e1ad8f-a3b3-52dd-89b7-8ae7e9d81eca', name: 'Mutual of Omaha Medicare Supplement', class: 'medsup', carrier: 'Mutual of Omaha');
    }
    private function __construct() {}

    /** @internal */
    public static function instance(): self { return new self(); }
}

/**
 * Typed accessor for the `preneed` product family.
 * Obtain via {@see Products::preneed()}.
 */
final class PreneedProducts
{
    public function betterlifeSinglePremium(): Product
    {
        return new Product(id: 'prod_558a0ca1-c2a3-5007-916d-28dde3eaeabb', name: 'BetterLife Single Premium', class: 'preneed', carrier: 'BetterLife');
    }

    public function globalAtlanticSimpleProtectionPlan(): Product
    {
        return new Product(id: 'prod_52d6ba39-47d6-5527-bd4a-49bca391ab19', name: 'Global Atlantic Simple Protection Plan', class: 'preneed', carrier: 'Global Atlantic');
    }
    private function __construct() {}

    /** @internal */
    public static function instance(): self { return new self(); }
}

final class Products
{
    /**
     * Returns the `fex` family accessor.
     * Usage: Products::fex()->aetnaAccendo()
     */
    public static function fex(): FexProducts
    {
        return FexProducts::instance();
    }

    /**
     * Returns the `term` family accessor.
     * Usage: Products::term()->aetnaAccendo()
     */
    public static function term(): TermProducts
    {
        return TermProducts::instance();
    }

    /**
     * Returns the `medsup` family accessor.
     * Usage: Products::medsup()->aetnaAccendo()
     */
    public static function medsup(): MedsupProducts
    {
        return MedsupProducts::instance();
    }

    /**
     * Returns the `preneed` family accessor.
     * Usage: Products::preneed()->aetnaAccendo()
     */
    public static function preneed(): PreneedProducts
    {
        return PreneedProducts::instance();
    }

    /**
     * Look up a product by its opaque id (`prod_<uuid>`).
     *
     * Returns `null` for unknown ids (including stale names — only ids work).
     *
     * Conformance: `Products::byId(Products::fex()->aetnaAccendo()->id)`
     * must return a Product equal to the constant.
     */
    public static function byId(string $id): ?Product
    {
        return self::idMap()[$id] ?? null;
    }

    /** @return array<string, Product> */
    private static function idMap(): array
    {
        /** @var array<string, Product>|null $cache */
        static $cache = null;
        if ($cache === null) {
            /** @var array<string, array{id:string, slug:string, displayName:string, carrier:string, class:string}> $data */
            $data  = require __DIR__ . '/data/products.php';
            $cache = [];
            foreach ($data as $id => $row) {
                $cache[$id] = new Product(
                    id:      $row['id'],
                    name:    $row['displayName'],
                    class:   $row['class'],
                    carrier: $row['carrier'],
                );
            }
        }
        return $cache;
    }

    private function __construct() {}
}
