"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - insurance/v2_products.json
from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType


@dataclass(frozen=True, slots=True)
class Product:
    """A catalog product carrying its stable opaque id.

    ``id`` (``prod_<uuid>``) is the identity key: the v3 prequalify
    ``products[]`` filter, the ``by_id`` handle, and the wire value.
    ``name``, ``product_class``, and ``carrier`` are display-time metadata;
    they may change when a carrier renames a product but ``id`` stays stable.

    Never construct directly — use :data:`Products`.Fex.AetnaAccendo etc.
    """

    id: str
    name: str
    product_class: str
    carrier: str


class _FexProducts:
    __slots__ = ()

    AetnaAccendo: Product = Product(id='prod_d7b57156-3e83-506b-8936-0692c1193dc7', name='Aetna Accendo', product_class='fex', carrier='Aetna')
    AetnaProtectionSeries: Product = Product(id='prod_2ebf0de6-7151-59cb-8a3a-745be5255aa0', name='Aetna Protection Series', product_class='fex', carrier='Aetna')
    AflacFinalExpense: Product = Product(id='prod_2eaabda5-ea10-5803-b9fd-f92c0261a9c9', name='Aflac Final Expense', product_class='fex', carrier='Aflac')
    AmericanAmicableClearChoice: Product = Product(id='prod_76ea329c-3e29-539c-9cc4-fe8753bbf8c8', name='American Amicable Clear Choice', product_class='fex', carrier='American Amicable')
    AmericanAmicableDignitySolutions: Product = Product(id='prod_444bd8e6-1253-5837-9f30-e3e4efe721b2', name='American Amicable Dignity Solutions', product_class='fex', carrier='American Amicable')
    AmericanAmicableGoldenSolution: Product = Product(id='prod_b630f531-dd7b-48e2-8f2f-1b03b97ed2f9', name='American Amicable Golden Solution', product_class='fex', carrier='American Amicable')
    AmericanAmicableInnovativeSolutions: Product = Product(id='prod_1a546f99-9e24-4aec-b80d-99f8a0641230', name='American Amicable Innovative Solutions', product_class='fex', carrier='American Amicable')
    AmericanAmicablePlatinumSolutionLegacyPlan: Product = Product(id='prod_fbf0beb6-5933-5810-8973-675454c64e54', name='American Amicable Platinum Solution Legacy Plan', product_class='fex', carrier='American Amicable')
    AmericanAmicableSeniorChoice: Product = Product(id='prod_6b8e3fdb-79da-4e0c-81f5-534aaca277dd', name='American Amicable Senior Choice', product_class='fex', carrier='American Amicable')
    AmericanAmicableTribute: Product = Product(id='prod_a9725d37-f0c9-429b-94fb-c5c4d1fa1d53', name='American Amicable Tribute', product_class='fex', carrier='American Amicable')
    AmericanHomeLifeGuidestar: Product = Product(id='prod_9e575f61-4618-53cf-b321-6038b98c4ea5', name='American Home Life Guidestar', product_class='fex', carrier='American Home Life')
    AmericanHomeLifePatriotSeries: Product = Product(id='prod_18005d37-9bee-588a-81e6-9f3ba641da35', name='American Home Life Patriot Series', product_class='fex', carrier='American Home Life')
    AmericoEaglePremier: Product = Product(id='prod_14bbd5ef-adb9-575a-ba14-45da192bc0a3', name='Americo Eagle Premier', product_class='fex', carrier='Americo')
    BaltimoreLifeIprovide: Product = Product(id='prod_44937aff-cd7f-4484-b6d3-3dc84cd73491', name='Baltimore Life iProvide', product_class='fex', carrier='Baltimore Life')
    BaltimoreLifeSilverGuard: Product = Product(id='prod_4cda675a-9760-51ac-bb70-1e33e83502be', name='Baltimore Life Silver Guard', product_class='fex', carrier='Baltimore Life')
    BetterlifeFinalExpense: Product = Product(id='prod_e0cbd195-3967-5127-b9d7-9d763f9812b9', name='BetterLife Final Expense', product_class='fex', carrier='BetterLife')
    CentrianLivingLegacy: Product = Product(id='prod_ad1bf475-7997-5d4b-9034-bf9d4f0a0494', name='Centrian Living Legacy', product_class='fex', carrier='Centrian')
    CicaLifeSuperiorChoice: Product = Product(id='prod_0940211a-bc9b-509b-ae1a-6e279eed776b', name='CICA Life Superior Choice', product_class='fex', carrier='CICA Life')
    CignaIndividualWholeLife: Product = Product(id='prod_b11f7348-2716-5dae-b588-ed2a54ac4c04', name='Cigna Individual Whole Life', product_class='fex', carrier='Cigna')
    CombinedGenerationalLife: Product = Product(id='prod_50911138-79a1-4c20-911a-a37a3054e01a', name='Combined Generational Life', product_class='fex', carrier='Combined')
    CorebridgeGiwl: Product = Product(id='prod_e49fed5b-0803-480f-9ac4-8774353681ab', name='Corebridge GIWL', product_class='fex', carrier='Corebridge')
    CorebridgeSimplinowLegacy: Product = Product(id='prod_7eb671f1-781f-432d-b887-85195902c1cb', name='Corebridge SimpliNow Legacy', product_class='fex', carrier='Corebridge')
    EmcEasylife: Product = Product(id='prod_e1bda62f-59ba-5770-b4a4-9a3df49243bf', name='EMC EasyLife', product_class='fex', carrier='EMC')
    EverestIaAmericanAdvantage50Plus: Product = Product(id='prod_bb930420-5ed3-5d8a-94f5-a6d9d0571179', name='Everest IA American Advantage 50 Plus', product_class='fex', carrier='Everest IA American')
    FamilyBenefitLifeGoldenEagle: Product = Product(id='prod_8b224dea-1a89-55ed-8e76-b394d707da1b', name='Family Benefit Life Golden Eagle', product_class='fex', carrier='Family Benefit Life')
    FidelityLifeRapidecision: Product = Product(id='prod_510ecb6e-5801-53b3-89aa-d578ead5b623', name='Fidelity Life RAPIDecision', product_class='fex', carrier='Fidelity Life')
    FidelityLifeRapidecisionSeniorLife: Product = Product(id='prod_39f74284-c3a3-5ef4-a499-96c80246e57f', name='Fidelity Life RAPIDecision Senior Life', product_class='fex', carrier='Fidelity Life')
    FirstGuarantyInsuranceSecurityCare: Product = Product(id='prod_f7143a73-aac8-55c7-9f7f-a69462cb5b7e', name='First Guaranty Insurance Security Care', product_class='fex', carrier='First Guaranty Insurance')
    ForestersPlanRight: Product = Product(id='prod_9577974b-a9f3-5da2-9855-1924074044dd', name='Foresters Plan Right', product_class='fex', carrier='Foresters')
    GerberLife: Product = Product(id='prod_dc4e84b8-8099-51c9-ae31-37c78c0a8d39', name='Gerber Life', product_class='fex', carrier='Gerber')
    GpmLifeSecureMark: Product = Product(id='prod_83b78dd8-a77b-558e-9b3b-c9cc5251c613', name='GPM Life Secure Mark', product_class='fex', carrier='GPM Life')
    GtlHeritagePlan: Product = Product(id='prod_142e101a-749e-4e28-90ea-2f8fed3b6970', name='GTL Heritage Plan', product_class='fex', carrier='GTL')
    IllinoisMutualPathProtectorPlus: Product = Product(id='prod_e2aea5b2-316d-5150-8504-2e3c2a4e3276', name='Illinois Mutual Path Protector Plus', product_class='fex', carrier='Illinois Mutual')
    KskjFinalExpense: Product = Product(id='prod_d93892e6-0035-5f82-8427-1bd9e49b1959', name='KSKJ Final Expense', product_class='fex', carrier='KSKJ')
    LibertyBankersSimpl: Product = Product(id='prod_fe3498ec-29a7-5dba-9da9-6a32cb3dc91e', name='Liberty Bankers Simpl', product_class='fex', carrier='Liberty Bankers')
    LifeShieldSurvivor: Product = Product(id='prod_d155e90c-cba1-51cf-9d9c-e6518fa13d37', name='Life Shield Survivor', product_class='fex', carrier='Life Shield')
    ManhattanLifeSecureAdvantage: Product = Product(id='prod_afbfa67e-a41d-45be-bcbc-bf31e7de669f', name='Manhattan Life Secure Advantage', product_class='fex', carrier='Manhattan Life')
    MutualOfOmahaLivingPromise: Product = Product(id='prod_cb26875d-f5b2-52f7-8f89-66cb3d779bf8', name='Mutual of Omaha Living Promise', product_class='fex', carrier='Mutual of Omaha')
    NewbridgeFinalExpense: Product = Product(id='prod_007e74bf-671c-41cc-be27-28cfd75fd5d2', name='Newbridge Final Expense', product_class='fex', carrier='Newbridge')
    OccidentalLifeClearChoice: Product = Product(id='prod_b06445f5-5e02-5111-863b-5e1260b4524b', name='Occidental Life Clear Choice', product_class='fex', carrier='Occidental Life')
    OccidentalLifeDignitySolutions: Product = Product(id='prod_07bdd66e-7e3c-5f7f-9c8e-b4bb414dd9e2', name='Occidental Life Dignity Solutions', product_class='fex', carrier='Occidental Life')
    OccidentalLifeGoldenSolution: Product = Product(id='prod_d2eeac7e-6aad-5eee-83e1-fd2aee0da64c', name='Occidental Life Golden Solution', product_class='fex', carrier='Occidental Life')
    OccidentalLifeInnovativeSolutions: Product = Product(id='prod_4b038ed0-2aa2-58e6-9c62-9aa736e4d9b5', name='Occidental Life Innovative Solutions', product_class='fex', carrier='Occidental Life')
    OccidentalLifePlatinumSolutionLegacyPlan: Product = Product(id='prod_fbd566f8-72f6-5383-84e9-a84c517c8815', name='Occidental Life Platinum Solution Legacy Plan', product_class='fex', carrier='Occidental Life')
    OccidentalLifeSeniorChoice: Product = Product(id='prod_97d8f31d-764a-549c-9834-6691e1db06a8', name='Occidental Life Senior Choice', product_class='fex', carrier='Occidental Life')
    OccidentalLifeTribute: Product = Product(id='prod_0c5d1d8d-dd9e-59b8-a5c7-dddfd4b7da1a', name='Occidental Life Tribute', product_class='fex', carrier='Occidental Life')
    OxfordLifeSimplifiedIssue: Product = Product(id='prod_a5a3a129-cf4d-57bf-a278-034b65348c11', name='Oxford Life Simplified Issue', product_class='fex', carrier='Oxford Life')
    PekinWholeLife: Product = Product(id='prod_8e946869-fe0e-5f8c-a231-cc1671e4b2d4', name='Pekin Whole Life', product_class='fex', carrier='Pekin')
    PioneerAmericanIndependentAmerican: Product = Product(id='prod_42cfd631-69ea-5711-858d-168503cb0680', name='Pioneer American Independent American', product_class='fex', carrier='Pioneer American')
    PioneerAmericanNorthstarLegacy: Product = Product(id='prod_ec518d73-777d-5976-b4fd-d2e0b6332c56', name='Pioneer American NorthStar Legacy', product_class='fex', carrier='Pioneer American')
    RoyalArcanumGraded: Product = Product(id='prod_4d67b7ca-cc86-5849-8e32-5e22bea6cdce', name='Royal Arcanum Graded', product_class='fex', carrier='Royal Arcanum')
    RoyalArcanumSimplifiedIssue: Product = Product(id='prod_bf77cdcd-078d-534c-a923-861ce722a0e8', name='Royal Arcanum Simplified Issue', product_class='fex', carrier='Royal Arcanum')
    RoyalNeighborsEnsuredLegacy: Product = Product(id='prod_b039d938-ced2-4496-ad4d-f28b795b8089', name='Royal Neighbors Ensured Legacy', product_class='fex', carrier='Royal Neighbors')
    SUsaGoldenPromise: Product = Product(id='prod_79a26030-6b45-416a-b97d-02e0200a4d39', name='S.USA Golden Promise', product_class='fex', carrier='S.USA')
    SbliLivingLegacy: Product = Product(id='prod_09b94921-6ba1-5f17-92da-5750c2c0b12a', name='SBLI Living Legacy', product_class='fex', carrier='SBLI')
    SecuricoLifeFinalExpense: Product = Product(id='prod_e2a56a6e-9d28-51d2-893f-b980998b7822', name='Securico Life Final Expense', product_class='fex', carrier='Securico Life')
    SecurityNationalSimpleSecurity: Product = Product(id='prod_81f01f85-1d97-58b1-9892-f7fd66ac2152', name='Security National Simple Security', product_class='fex', carrier='Security National')
    SeniorLifeWholeLife: Product = Product(id='prod_ed4476ae-f668-4a64-96cc-d618c1f018b8', name='Senior Life Whole Life', product_class='fex', carrier='Senior Life')
    SentinelSecurityNewVantage: Product = Product(id='prod_cac5f3fe-1d7a-5865-84cf-8000ff8bcfd7', name='Sentinel Security New Vantage', product_class='fex', carrier='Sentinel Security')
    SonsOfNorwayLegacySure: Product = Product(id='prod_2dec8fd4-8ead-4862-a51e-e51f7aae8ee5', name='Sons of Norway Legacy Sure', product_class='fex', carrier='Sons of Norway')
    SonsOfNorwayWholeLife: Product = Product(id='prod_9b00ed35-28a2-4ce6-a50e-914213419d6b', name='Sons of Norway Whole Life', product_class='fex', carrier='Sons of Norway')
    TransamericaFeExpressSolution: Product = Product(id='prod_18477e53-831f-47bf-829c-0237c23b6fb6', name='TransAmerica FE Express Solution', product_class='fex', carrier='TransAmerica')
    TransamericaSolution: Product = Product(id='prod_e64af080-608b-5c34-ba46-166d008fa249', name='TransAmerica Solution', product_class='fex', carrier='TransAmerica')
    TrinityGoldenEagle: Product = Product(id='prod_19c56704-7c68-5320-9a8a-042c94ceba64', name='Trinity Golden Eagle', product_class='fex', carrier='Trinity')
    UnitedFarmAndFamilyWholeLife: Product = Product(id='prod_a6f48502-08be-5a6b-9934-d3cb3f470972', name='United Farm And Family Whole Life', product_class='fex', carrier='United Farm And Family')
    UnitedHomeLifeWholeLife: Product = Product(id='prod_d851aa99-47f9-5400-a966-97a0b5a71bb3', name='United Home Life Whole Life', product_class='fex', carrier='United Home Life')


class _MedsupProducts:
    __slots__ = ()

    AetnaAccendoMedsup: Product = Product(id='prod_c134cc26-08e2-5489-8e60-8bea89e89f49', name='Aetna Accendo Medicare Supplement', product_class='medsup', carrier='Aetna Accendo')
    AetnaMedsup: Product = Product(id='prod_8378b6bc-e99a-5f77-8f0d-cc978560c72f', name='Aetna Medicare Supplement', product_class='medsup', carrier='Aetna')
    ManhattanLifeMedsup: Product = Product(id='prod_5ba7fc1f-0bd8-5f49-827a-ca049312920f', name='Manhattan Life Medicare Supplement', product_class='medsup', carrier='Manhattan Life')
    MutualOfOmahaMedsup: Product = Product(id='prod_88e1ad8f-a3b3-52dd-89b7-8ae7e9d81eca', name='Mutual of Omaha Medicare Supplement', product_class='medsup', carrier='Mutual of Omaha')


class _PreneedProducts:
    __slots__ = ()

    BetterlifeSinglePremium: Product = Product(id='prod_558a0ca1-c2a3-5007-916d-28dde3eaeabb', name='BetterLife Single Premium', product_class='preneed', carrier='BetterLife')
    GlobalAtlanticSimpleProtectionPlan: Product = Product(id='prod_52d6ba39-47d6-5527-bd4a-49bca391ab19', name='Global Atlantic Simple Protection Plan', product_class='preneed', carrier='Global Atlantic')


class _TermProducts:
    __slots__ = ()

    AmericanAmicableEasyTerm: Product = Product(id='prod_8bf67d18-391b-51c2-9333-cf557e81d1ff', name='American Amicable Easy Term', product_class='term', carrier='American Amicable')
    AmericanAmicableHomeProtector: Product = Product(id='prod_7f5a7c56-8ef1-5874-a3c6-6433b4c6c3c4', name='American Amicable Home Protector', product_class='term', carrier='American Amicable')
    AmericanAmicableTermMadeSimple: Product = Product(id='prod_d6147bbb-b210-5422-9ec4-41de0379e552', name='American Amicable Term Made Simple', product_class='term', carrier='American Amicable')
    AmericoHmsPlus: Product = Product(id='prod_9b379a0d-320e-50ac-bd2e-8519ea503286', name='Americo HMS PLUS', product_class='term', carrier='Americo')
    AmeritasFlxLivingBenefitsTerm: Product = Product(id='prod_e832f26e-f6e6-5009-8c13-d17e5bc6a02f', name='Ameritas FLX Living Benefits Term', product_class='term', carrier='Ameritas')
    AmeritasValuePlusTerm: Product = Product(id='prod_6b476015-eeca-5f02-a259-36820bd47b98', name='Ameritas Value Plus Term', product_class='term', carrier='Ameritas')
    BannerOpterm: Product = Product(id='prod_58edb7da-536d-51d3-8a23-ecb500d37de3', name='Banner OPTerm', product_class='term', carrier='Banner')
    CorebridgeSelectATerm: Product = Product(id='prod_72169acb-1a87-5848-9df0-96454c709b81', name='Corebridge Select A Term', product_class='term', carrier='Corebridge')
    FidelityLifeInstabrainPureTerm: Product = Product(id='prod_ddcffff2-12d0-4549-a6af-1eee7d73d646', name='Fidelity Life InstaBrain Pure Term', product_class='term', carrier='Fidelity Life')
    FidelityLifeInstabrainTerm: Product = Product(id='prod_10f36326-2bd4-5ae1-8463-e04ad594db6c', name='Fidelity Life InstaBrain Term', product_class='term', carrier='Fidelity Life')
    FidelityLifeInstaterm: Product = Product(id='prod_e1c66430-dec1-571a-b96b-17231fe55c12', name='Fidelity Life InstaTerm', product_class='term', carrier='Fidelity Life')
    ForestersStrongFoundation: Product = Product(id='prod_797c9cc3-325f-5058-b092-ca811dfd89cf', name='Foresters Strong Foundation', product_class='term', carrier='Foresters')
    ForestersYourTerm: Product = Product(id='prod_82b87fc0-e3dc-5fb6-bf18-85035e6cb8cf', name='Foresters Your Term', product_class='term', carrier='Foresters')
    ForestersYourTermNonMedical: Product = Product(id='prod_f5c30718-4681-599f-8110-b5aaacd778c7', name='Foresters Your Term Non Medical', product_class='term', carrier='Foresters')
    GpmQMark: Product = Product(id='prod_bb80c30b-eba4-5319-8ba6-13d807bfba9a', name='GPM Q Mark', product_class='term', carrier='GPM')
    GtlTurboTerm: Product = Product(id='prod_a8249c2b-5277-5113-8ecc-4d8b0f507662', name='GTL Turbo Term', product_class='term', carrier='GTL')
    HeroLifeTerm: Product = Product(id='prod_7f6016d9-9f12-5f75-a57a-cd16ddffe99c', name='Hero Life Term', product_class='term', carrier='Hero Life')
    JohnHancockSimpleTermWithVitality: Product = Product(id='prod_0d293690-3896-530f-a94b-aa2cb72d30bd', name='John Hancock Simple Term with Vitality', product_class='term', carrier='John Hancock')
    KansasCityLifeSignatureTermExpress: Product = Product(id='prod_65015b8a-d64d-55f1-9ca1-06588d8b073e', name='Kansas City Life Signature Term Express', product_class='term', carrier='Kansas City Life')
    LincolnLifeelements: Product = Product(id='prod_9071ccab-2830-59ed-8715-f2330215bf0d', name='Lincoln LifeElements', product_class='term', carrier='Lincoln')
    LincolnTermaccel: Product = Product(id='prod_45751b44-a561-54c2-9e1d-4120fdc09e7f', name='Lincoln TermAccel', product_class='term', carrier='Lincoln')
    MutualOfOmahaTermLifeAnswers: Product = Product(id='prod_ab68ec62-2afe-561c-acd7-dab8eaf56846', name='Mutual of Omaha Term Life Answers', product_class='term', carrier='Mutual of Omaha')
    MutualOfOmahaTermLifeExpress: Product = Product(id='prod_1452309d-291d-54dc-aca7-cc313811a239', name='Mutual of Omaha Term Life Express', product_class='term', carrier='Mutual of Omaha')
    NationwideYourlife: Product = Product(id='prod_f8d141bf-d0b5-5a97-9226-4b1ab5380d47', name='Nationwide YourLife', product_class='term', carrier='Nationwide')
    NorthAmericanAddvantage: Product = Product(id='prod_29cffca2-ddfc-54de-a94b-65595b68adf3', name='North American ADDvantage', product_class='term', carrier='North American')
    ProsperityFamilyFreedomTerm: Product = Product(id='prod_090de60e-d322-55d9-8ef5-a010e5275cc5', name='Prosperity Family Freedom Term', product_class='term', carrier='Prosperity')
    ProtectiveLifeClassicChoiceTerm: Product = Product(id='prod_b11965d0-4866-5e50-b348-d93e09832867', name='Protective Life Classic Choice Term', product_class='term', carrier='Protective Life')
    ProtectiveLifeCustomChoiceTerm: Product = Product(id='prod_6a8bfb0c-15da-51f4-a267-6d237e125d97', name='Protective Life Custom Choice Term', product_class='term', carrier='Protective Life')
    PrudentialEssentialTermPlus: Product = Product(id='prod_80952375-cbed-5817-910c-07475af33604', name='Prudential Essential Term Plus', product_class='term', carrier='Prudential')
    PrudentialEssentialTermValue: Product = Product(id='prod_3d619542-5829-5d2a-9450-6e2673e7cb94', name='Prudential Essential Term Value', product_class='term', carrier='Prudential')
    SagicorSageTerm: Product = Product(id='prod_3a9f8911-2d94-5f27-88b8-62dcc7d5727a', name='Sagicor Sage Term', product_class='term', carrier='Sagicor')
    SbliTTerm: Product = Product(id='prod_360fe967-f7e1-5ab4-8f1a-e56e9ef543ab', name='SBLI T Term', product_class='term', carrier='SBLI')
    SeniorLifeTermLife: Product = Product(id='prod_ccebb3f4-2be4-5a64-8365-6e72faf5185d', name='Senior Life Term Life', product_class='term', carrier='Senior Life')
    TransamericaTrendsetterLb: Product = Product(id='prod_bcfc35ae-30d7-5466-9267-06d09faa3319', name='TransAmerica Trendsetter LB', product_class='term', carrier='TransAmerica')
    TransamericaTrendsetterSuper: Product = Product(id='prod_90d1b5da-5063-56e7-b737-d44b77126da2', name='TransAmerica Trendsetter Super', product_class='term', carrier='TransAmerica')
    WilliamPennOpterm: Product = Product(id='prod_482585d7-6c1c-5042-b42b-09ef12933d1d', name='William Penn OPTerm', product_class='term', carrier='William Penn')


_BY_ID: MappingProxyType[str, Product] = MappingProxyType({
    'prod_007e74bf-671c-41cc-be27-28cfd75fd5d2': _FexProducts.NewbridgeFinalExpense,
    'prod_07bdd66e-7e3c-5f7f-9c8e-b4bb414dd9e2': _FexProducts.OccidentalLifeDignitySolutions,
    'prod_090de60e-d322-55d9-8ef5-a010e5275cc5': _TermProducts.ProsperityFamilyFreedomTerm,
    'prod_0940211a-bc9b-509b-ae1a-6e279eed776b': _FexProducts.CicaLifeSuperiorChoice,
    'prod_09b94921-6ba1-5f17-92da-5750c2c0b12a': _FexProducts.SbliLivingLegacy,
    'prod_0c5d1d8d-dd9e-59b8-a5c7-dddfd4b7da1a': _FexProducts.OccidentalLifeTribute,
    'prod_0d293690-3896-530f-a94b-aa2cb72d30bd': _TermProducts.JohnHancockSimpleTermWithVitality,
    'prod_10f36326-2bd4-5ae1-8463-e04ad594db6c': _TermProducts.FidelityLifeInstabrainTerm,
    'prod_142e101a-749e-4e28-90ea-2f8fed3b6970': _FexProducts.GtlHeritagePlan,
    'prod_1452309d-291d-54dc-aca7-cc313811a239': _TermProducts.MutualOfOmahaTermLifeExpress,
    'prod_14bbd5ef-adb9-575a-ba14-45da192bc0a3': _FexProducts.AmericoEaglePremier,
    'prod_18005d37-9bee-588a-81e6-9f3ba641da35': _FexProducts.AmericanHomeLifePatriotSeries,
    'prod_18477e53-831f-47bf-829c-0237c23b6fb6': _FexProducts.TransamericaFeExpressSolution,
    'prod_19c56704-7c68-5320-9a8a-042c94ceba64': _FexProducts.TrinityGoldenEagle,
    'prod_1a546f99-9e24-4aec-b80d-99f8a0641230': _FexProducts.AmericanAmicableInnovativeSolutions,
    'prod_29cffca2-ddfc-54de-a94b-65595b68adf3': _TermProducts.NorthAmericanAddvantage,
    'prod_2dec8fd4-8ead-4862-a51e-e51f7aae8ee5': _FexProducts.SonsOfNorwayLegacySure,
    'prod_2eaabda5-ea10-5803-b9fd-f92c0261a9c9': _FexProducts.AflacFinalExpense,
    'prod_2ebf0de6-7151-59cb-8a3a-745be5255aa0': _FexProducts.AetnaProtectionSeries,
    'prod_360fe967-f7e1-5ab4-8f1a-e56e9ef543ab': _TermProducts.SbliTTerm,
    'prod_39f74284-c3a3-5ef4-a499-96c80246e57f': _FexProducts.FidelityLifeRapidecisionSeniorLife,
    'prod_3a9f8911-2d94-5f27-88b8-62dcc7d5727a': _TermProducts.SagicorSageTerm,
    'prod_3d619542-5829-5d2a-9450-6e2673e7cb94': _TermProducts.PrudentialEssentialTermValue,
    'prod_42cfd631-69ea-5711-858d-168503cb0680': _FexProducts.PioneerAmericanIndependentAmerican,
    'prod_444bd8e6-1253-5837-9f30-e3e4efe721b2': _FexProducts.AmericanAmicableDignitySolutions,
    'prod_44937aff-cd7f-4484-b6d3-3dc84cd73491': _FexProducts.BaltimoreLifeIprovide,
    'prod_45751b44-a561-54c2-9e1d-4120fdc09e7f': _TermProducts.LincolnTermaccel,
    'prod_482585d7-6c1c-5042-b42b-09ef12933d1d': _TermProducts.WilliamPennOpterm,
    'prod_4b038ed0-2aa2-58e6-9c62-9aa736e4d9b5': _FexProducts.OccidentalLifeInnovativeSolutions,
    'prod_4cda675a-9760-51ac-bb70-1e33e83502be': _FexProducts.BaltimoreLifeSilverGuard,
    'prod_4d67b7ca-cc86-5849-8e32-5e22bea6cdce': _FexProducts.RoyalArcanumGraded,
    'prod_50911138-79a1-4c20-911a-a37a3054e01a': _FexProducts.CombinedGenerationalLife,
    'prod_510ecb6e-5801-53b3-89aa-d578ead5b623': _FexProducts.FidelityLifeRapidecision,
    'prod_52d6ba39-47d6-5527-bd4a-49bca391ab19': _PreneedProducts.GlobalAtlanticSimpleProtectionPlan,
    'prod_558a0ca1-c2a3-5007-916d-28dde3eaeabb': _PreneedProducts.BetterlifeSinglePremium,
    'prod_58edb7da-536d-51d3-8a23-ecb500d37de3': _TermProducts.BannerOpterm,
    'prod_5ba7fc1f-0bd8-5f49-827a-ca049312920f': _MedsupProducts.ManhattanLifeMedsup,
    'prod_65015b8a-d64d-55f1-9ca1-06588d8b073e': _TermProducts.KansasCityLifeSignatureTermExpress,
    'prod_6a8bfb0c-15da-51f4-a267-6d237e125d97': _TermProducts.ProtectiveLifeCustomChoiceTerm,
    'prod_6b476015-eeca-5f02-a259-36820bd47b98': _TermProducts.AmeritasValuePlusTerm,
    'prod_6b8e3fdb-79da-4e0c-81f5-534aaca277dd': _FexProducts.AmericanAmicableSeniorChoice,
    'prod_72169acb-1a87-5848-9df0-96454c709b81': _TermProducts.CorebridgeSelectATerm,
    'prod_76ea329c-3e29-539c-9cc4-fe8753bbf8c8': _FexProducts.AmericanAmicableClearChoice,
    'prod_797c9cc3-325f-5058-b092-ca811dfd89cf': _TermProducts.ForestersStrongFoundation,
    'prod_79a26030-6b45-416a-b97d-02e0200a4d39': _FexProducts.SUsaGoldenPromise,
    'prod_7eb671f1-781f-432d-b887-85195902c1cb': _FexProducts.CorebridgeSimplinowLegacy,
    'prod_7f5a7c56-8ef1-5874-a3c6-6433b4c6c3c4': _TermProducts.AmericanAmicableHomeProtector,
    'prod_7f6016d9-9f12-5f75-a57a-cd16ddffe99c': _TermProducts.HeroLifeTerm,
    'prod_80952375-cbed-5817-910c-07475af33604': _TermProducts.PrudentialEssentialTermPlus,
    'prod_81f01f85-1d97-58b1-9892-f7fd66ac2152': _FexProducts.SecurityNationalSimpleSecurity,
    'prod_82b87fc0-e3dc-5fb6-bf18-85035e6cb8cf': _TermProducts.ForestersYourTerm,
    'prod_8378b6bc-e99a-5f77-8f0d-cc978560c72f': _MedsupProducts.AetnaMedsup,
    'prod_83b78dd8-a77b-558e-9b3b-c9cc5251c613': _FexProducts.GpmLifeSecureMark,
    'prod_88e1ad8f-a3b3-52dd-89b7-8ae7e9d81eca': _MedsupProducts.MutualOfOmahaMedsup,
    'prod_8b224dea-1a89-55ed-8e76-b394d707da1b': _FexProducts.FamilyBenefitLifeGoldenEagle,
    'prod_8bf67d18-391b-51c2-9333-cf557e81d1ff': _TermProducts.AmericanAmicableEasyTerm,
    'prod_8e946869-fe0e-5f8c-a231-cc1671e4b2d4': _FexProducts.PekinWholeLife,
    'prod_9071ccab-2830-59ed-8715-f2330215bf0d': _TermProducts.LincolnLifeelements,
    'prod_90d1b5da-5063-56e7-b737-d44b77126da2': _TermProducts.TransamericaTrendsetterSuper,
    'prod_9577974b-a9f3-5da2-9855-1924074044dd': _FexProducts.ForestersPlanRight,
    'prod_97d8f31d-764a-549c-9834-6691e1db06a8': _FexProducts.OccidentalLifeSeniorChoice,
    'prod_9b00ed35-28a2-4ce6-a50e-914213419d6b': _FexProducts.SonsOfNorwayWholeLife,
    'prod_9b379a0d-320e-50ac-bd2e-8519ea503286': _TermProducts.AmericoHmsPlus,
    'prod_9e575f61-4618-53cf-b321-6038b98c4ea5': _FexProducts.AmericanHomeLifeGuidestar,
    'prod_a5a3a129-cf4d-57bf-a278-034b65348c11': _FexProducts.OxfordLifeSimplifiedIssue,
    'prod_a6f48502-08be-5a6b-9934-d3cb3f470972': _FexProducts.UnitedFarmAndFamilyWholeLife,
    'prod_a8249c2b-5277-5113-8ecc-4d8b0f507662': _TermProducts.GtlTurboTerm,
    'prod_a9725d37-f0c9-429b-94fb-c5c4d1fa1d53': _FexProducts.AmericanAmicableTribute,
    'prod_ab68ec62-2afe-561c-acd7-dab8eaf56846': _TermProducts.MutualOfOmahaTermLifeAnswers,
    'prod_ad1bf475-7997-5d4b-9034-bf9d4f0a0494': _FexProducts.CentrianLivingLegacy,
    'prod_afbfa67e-a41d-45be-bcbc-bf31e7de669f': _FexProducts.ManhattanLifeSecureAdvantage,
    'prod_b039d938-ced2-4496-ad4d-f28b795b8089': _FexProducts.RoyalNeighborsEnsuredLegacy,
    'prod_b06445f5-5e02-5111-863b-5e1260b4524b': _FexProducts.OccidentalLifeClearChoice,
    'prod_b11965d0-4866-5e50-b348-d93e09832867': _TermProducts.ProtectiveLifeClassicChoiceTerm,
    'prod_b11f7348-2716-5dae-b588-ed2a54ac4c04': _FexProducts.CignaIndividualWholeLife,
    'prod_b630f531-dd7b-48e2-8f2f-1b03b97ed2f9': _FexProducts.AmericanAmicableGoldenSolution,
    'prod_bb80c30b-eba4-5319-8ba6-13d807bfba9a': _TermProducts.GpmQMark,
    'prod_bb930420-5ed3-5d8a-94f5-a6d9d0571179': _FexProducts.EverestIaAmericanAdvantage50Plus,
    'prod_bcfc35ae-30d7-5466-9267-06d09faa3319': _TermProducts.TransamericaTrendsetterLb,
    'prod_bf77cdcd-078d-534c-a923-861ce722a0e8': _FexProducts.RoyalArcanumSimplifiedIssue,
    'prod_c134cc26-08e2-5489-8e60-8bea89e89f49': _MedsupProducts.AetnaAccendoMedsup,
    'prod_cac5f3fe-1d7a-5865-84cf-8000ff8bcfd7': _FexProducts.SentinelSecurityNewVantage,
    'prod_cb26875d-f5b2-52f7-8f89-66cb3d779bf8': _FexProducts.MutualOfOmahaLivingPromise,
    'prod_ccebb3f4-2be4-5a64-8365-6e72faf5185d': _TermProducts.SeniorLifeTermLife,
    'prod_d155e90c-cba1-51cf-9d9c-e6518fa13d37': _FexProducts.LifeShieldSurvivor,
    'prod_d2eeac7e-6aad-5eee-83e1-fd2aee0da64c': _FexProducts.OccidentalLifeGoldenSolution,
    'prod_d6147bbb-b210-5422-9ec4-41de0379e552': _TermProducts.AmericanAmicableTermMadeSimple,
    'prod_d7b57156-3e83-506b-8936-0692c1193dc7': _FexProducts.AetnaAccendo,
    'prod_d851aa99-47f9-5400-a966-97a0b5a71bb3': _FexProducts.UnitedHomeLifeWholeLife,
    'prod_d93892e6-0035-5f82-8427-1bd9e49b1959': _FexProducts.KskjFinalExpense,
    'prod_dc4e84b8-8099-51c9-ae31-37c78c0a8d39': _FexProducts.GerberLife,
    'prod_ddcffff2-12d0-4549-a6af-1eee7d73d646': _TermProducts.FidelityLifeInstabrainPureTerm,
    'prod_e0cbd195-3967-5127-b9d7-9d763f9812b9': _FexProducts.BetterlifeFinalExpense,
    'prod_e1bda62f-59ba-5770-b4a4-9a3df49243bf': _FexProducts.EmcEasylife,
    'prod_e1c66430-dec1-571a-b96b-17231fe55c12': _TermProducts.FidelityLifeInstaterm,
    'prod_e2a56a6e-9d28-51d2-893f-b980998b7822': _FexProducts.SecuricoLifeFinalExpense,
    'prod_e2aea5b2-316d-5150-8504-2e3c2a4e3276': _FexProducts.IllinoisMutualPathProtectorPlus,
    'prod_e49fed5b-0803-480f-9ac4-8774353681ab': _FexProducts.CorebridgeGiwl,
    'prod_e64af080-608b-5c34-ba46-166d008fa249': _FexProducts.TransamericaSolution,
    'prod_e832f26e-f6e6-5009-8c13-d17e5bc6a02f': _TermProducts.AmeritasFlxLivingBenefitsTerm,
    'prod_ec518d73-777d-5976-b4fd-d2e0b6332c56': _FexProducts.PioneerAmericanNorthstarLegacy,
    'prod_ed4476ae-f668-4a64-96cc-d618c1f018b8': _FexProducts.SeniorLifeWholeLife,
    'prod_f5c30718-4681-599f-8110-b5aaacd778c7': _TermProducts.ForestersYourTermNonMedical,
    'prod_f7143a73-aac8-55c7-9f7f-a69462cb5b7e': _FexProducts.FirstGuarantyInsuranceSecurityCare,
    'prod_f8d141bf-d0b5-5a97-9226-4b1ab5380d47': _TermProducts.NationwideYourlife,
    'prod_fbd566f8-72f6-5383-84e9-a84c517c8815': _FexProducts.OccidentalLifePlatinumSolutionLegacyPlan,
    'prod_fbf0beb6-5933-5810-8973-675454c64e54': _FexProducts.AmericanAmicablePlatinumSolutionLegacyPlan,
    'prod_fe3498ec-29a7-5dba-9da9-6a32cb3dc91e': _FexProducts.LibertyBankersSimpl,
})


class _ProductsAPI:
    """Nested product catalog with ``by_id`` reverse lookup.

    Access products as ``Products.Fex.AetnaAccendo`` etc.
    Use ``Products.by_id(id)`` to resolve a ``prod_<uuid>`` back to its
    constant — the only supported lookup key. There is no ``by_slug``; slug
    is display-time metadata, not an identity key.
    """

    Fex: _FexProducts = _FexProducts()
    Medsup: _MedsupProducts = _MedsupProducts()
    Preneed: _PreneedProducts = _PreneedProducts()
    Term: _TermProducts = _TermProducts()

    def by_id(self, product_id: str) -> Product | None:
        """Return the :class:`Product` for a ``prod_<uuid>`` id, or ``None``."""
        return _BY_ID.get(product_id)

    def all(self) -> tuple[Product, ...]:
        """All products in catalog order (sorted by id)."""
        return tuple(_BY_ID.values())


Products = _ProductsAPI()

__all__ = ["Product", "Products"]
