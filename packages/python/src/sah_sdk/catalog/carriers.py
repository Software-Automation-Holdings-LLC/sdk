"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - insurance/v2_products.json
from __future__ import annotations

from dataclasses import dataclass

from .products import Product, _FexProducts, _MedsupProducts, _PreneedProducts, _TermProducts


@dataclass(frozen=True, slots=True)
class ProductCarrierMetadata:
    """Public metadata for a single carrier."""

    display_name: str
    products: tuple[Product, ...]
    #: ISO 2-letter state codes the carrier is licensed in. Empty today.
    states: tuple[str, ...]


_CARRIERS: dict[str, ProductCarrierMetadata] = {
    'aetna': ProductCarrierMetadata(display_name='Aetna', products=(_FexProducts.AetnaProtectionSeries, _MedsupProducts.AetnaMedsup, _FexProducts.AetnaAccendo,), states=()),
    'aetna-accendo': ProductCarrierMetadata(display_name='Aetna Accendo', products=(_MedsupProducts.AetnaAccendoMedsup,), states=()),
    'aflac': ProductCarrierMetadata(display_name='Aflac', products=(_FexProducts.AflacFinalExpense,), states=()),
    'american-amicable': ProductCarrierMetadata(display_name='American Amicable', products=(_FexProducts.AmericanAmicableInnovativeSolutions, _FexProducts.AmericanAmicableDignitySolutions, _FexProducts.AmericanAmicableSeniorChoice, _FexProducts.AmericanAmicableClearChoice, _TermProducts.AmericanAmicableHomeProtector, _TermProducts.AmericanAmicableEasyTerm, _FexProducts.AmericanAmicableTribute, _FexProducts.AmericanAmicableGoldenSolution, _TermProducts.AmericanAmicableTermMadeSimple, _FexProducts.AmericanAmicablePlatinumSolutionLegacyPlan,), states=()),
    'american-home-life': ProductCarrierMetadata(display_name='American Home Life', products=(_FexProducts.AmericanHomeLifePatriotSeries, _FexProducts.AmericanHomeLifeGuidestar,), states=()),
    'americo': ProductCarrierMetadata(display_name='Americo', products=(_FexProducts.AmericoEaglePremier, _TermProducts.AmericoHmsPlus,), states=()),
    'ameritas': ProductCarrierMetadata(display_name='Ameritas', products=(_TermProducts.AmeritasValuePlusTerm, _TermProducts.AmeritasFlxLivingBenefitsTerm,), states=()),
    'baltimore-life': ProductCarrierMetadata(display_name='Baltimore Life', products=(_FexProducts.BaltimoreLifeIprovide, _FexProducts.BaltimoreLifeSilverGuard,), states=()),
    'banner': ProductCarrierMetadata(display_name='Banner', products=(_TermProducts.BannerOpterm,), states=()),
    'betterlife': ProductCarrierMetadata(display_name='BetterLife', products=(_PreneedProducts.BetterlifeSinglePremium, _FexProducts.BetterlifeFinalExpense,), states=()),
    'centrian': ProductCarrierMetadata(display_name='Centrian', products=(_FexProducts.CentrianLivingLegacy,), states=()),
    'cica-life': ProductCarrierMetadata(display_name='CICA Life', products=(_FexProducts.CicaLifeSuperiorChoice,), states=()),
    'cigna': ProductCarrierMetadata(display_name='Cigna', products=(_FexProducts.CignaIndividualWholeLife,), states=()),
    'combined': ProductCarrierMetadata(display_name='Combined', products=(_FexProducts.CombinedGenerationalLife,), states=()),
    'corebridge': ProductCarrierMetadata(display_name='Corebridge', products=(_TermProducts.CorebridgeSelectATerm, _FexProducts.CorebridgeSimplinowLegacy, _FexProducts.CorebridgeGiwl,), states=()),
    'emc': ProductCarrierMetadata(display_name='EMC', products=(_FexProducts.EmcEasylife,), states=()),
    'everest-ia-american': ProductCarrierMetadata(display_name='Everest IA American', products=(_FexProducts.EverestIaAmericanAdvantage50Plus,), states=()),
    'family-benefit-life': ProductCarrierMetadata(display_name='Family Benefit Life', products=(_FexProducts.FamilyBenefitLifeGoldenEagle,), states=()),
    'fidelity-life': ProductCarrierMetadata(display_name='Fidelity Life', products=(_TermProducts.FidelityLifeInstabrainTerm, _FexProducts.FidelityLifeRapidecisionSeniorLife, _FexProducts.FidelityLifeRapidecision, _TermProducts.FidelityLifeInstabrainPureTerm, _TermProducts.FidelityLifeInstaterm,), states=()),
    'first-guaranty-insurance': ProductCarrierMetadata(display_name='First Guaranty Insurance', products=(_FexProducts.FirstGuarantyInsuranceSecurityCare,), states=()),
    'foresters': ProductCarrierMetadata(display_name='Foresters', products=(_TermProducts.ForestersStrongFoundation, _TermProducts.ForestersYourTerm, _FexProducts.ForestersPlanRight, _TermProducts.ForestersYourTermNonMedical,), states=()),
    'gerber': ProductCarrierMetadata(display_name='Gerber', products=(_FexProducts.GerberLife,), states=()),
    'global-atlantic': ProductCarrierMetadata(display_name='Global Atlantic', products=(_PreneedProducts.GlobalAtlanticSimpleProtectionPlan,), states=()),
    'gpm': ProductCarrierMetadata(display_name='GPM', products=(_TermProducts.GpmQMark,), states=()),
    'gpm-life': ProductCarrierMetadata(display_name='GPM Life', products=(_FexProducts.GpmLifeSecureMark,), states=()),
    'gtl': ProductCarrierMetadata(display_name='GTL', products=(_FexProducts.GtlHeritagePlan, _TermProducts.GtlTurboTerm,), states=()),
    'hero-life': ProductCarrierMetadata(display_name='Hero Life', products=(_TermProducts.HeroLifeTerm,), states=()),
    'illinois-mutual': ProductCarrierMetadata(display_name='Illinois Mutual', products=(_FexProducts.IllinoisMutualPathProtectorPlus,), states=()),
    'john-hancock': ProductCarrierMetadata(display_name='John Hancock', products=(_TermProducts.JohnHancockSimpleTermWithVitality,), states=()),
    'kansas-city-life': ProductCarrierMetadata(display_name='Kansas City Life', products=(_TermProducts.KansasCityLifeSignatureTermExpress,), states=()),
    'kskj': ProductCarrierMetadata(display_name='KSKJ', products=(_FexProducts.KskjFinalExpense,), states=()),
    'liberty-bankers': ProductCarrierMetadata(display_name='Liberty Bankers', products=(_FexProducts.LibertyBankersSimpl,), states=()),
    'life-shield': ProductCarrierMetadata(display_name='Life Shield', products=(_FexProducts.LifeShieldSurvivor,), states=()),
    'lincoln': ProductCarrierMetadata(display_name='Lincoln', products=(_TermProducts.LincolnTermaccel, _TermProducts.LincolnLifeelements,), states=()),
    'manhattan-life': ProductCarrierMetadata(display_name='Manhattan Life', products=(_MedsupProducts.ManhattanLifeMedsup, _FexProducts.ManhattanLifeSecureAdvantage,), states=()),
    'mutual-of-omaha': ProductCarrierMetadata(display_name='Mutual of Omaha', products=(_TermProducts.MutualOfOmahaTermLifeExpress, _MedsupProducts.MutualOfOmahaMedsup, _TermProducts.MutualOfOmahaTermLifeAnswers, _FexProducts.MutualOfOmahaLivingPromise,), states=()),
    'nationwide': ProductCarrierMetadata(display_name='Nationwide', products=(_TermProducts.NationwideYourlife,), states=()),
    'newbridge': ProductCarrierMetadata(display_name='Newbridge', products=(_FexProducts.NewbridgeFinalExpense,), states=()),
    'north-american': ProductCarrierMetadata(display_name='North American', products=(_TermProducts.NorthAmericanAddvantage,), states=()),
    'occidental-life': ProductCarrierMetadata(display_name='Occidental Life', products=(_FexProducts.OccidentalLifeDignitySolutions, _FexProducts.OccidentalLifeTribute, _FexProducts.OccidentalLifeInnovativeSolutions, _FexProducts.OccidentalLifeSeniorChoice, _FexProducts.OccidentalLifeClearChoice, _FexProducts.OccidentalLifeGoldenSolution, _FexProducts.OccidentalLifePlatinumSolutionLegacyPlan,), states=()),
    'oxford-life': ProductCarrierMetadata(display_name='Oxford Life', products=(_FexProducts.OxfordLifeSimplifiedIssue,), states=()),
    'pekin': ProductCarrierMetadata(display_name='Pekin', products=(_FexProducts.PekinWholeLife,), states=()),
    'pioneer-american': ProductCarrierMetadata(display_name='Pioneer American', products=(_FexProducts.PioneerAmericanIndependentAmerican, _FexProducts.PioneerAmericanNorthstarLegacy,), states=()),
    'prosperity': ProductCarrierMetadata(display_name='Prosperity', products=(_TermProducts.ProsperityFamilyFreedomTerm,), states=()),
    'protective-life': ProductCarrierMetadata(display_name='Protective Life', products=(_TermProducts.ProtectiveLifeCustomChoiceTerm, _TermProducts.ProtectiveLifeClassicChoiceTerm,), states=()),
    'prudential': ProductCarrierMetadata(display_name='Prudential', products=(_TermProducts.PrudentialEssentialTermValue, _TermProducts.PrudentialEssentialTermPlus,), states=()),
    'royal-arcanum': ProductCarrierMetadata(display_name='Royal Arcanum', products=(_FexProducts.RoyalArcanumGraded, _FexProducts.RoyalArcanumSimplifiedIssue,), states=()),
    'royal-neighbors': ProductCarrierMetadata(display_name='Royal Neighbors', products=(_FexProducts.RoyalNeighborsEnsuredLegacy,), states=()),
    's-usa': ProductCarrierMetadata(display_name='S.USA', products=(_FexProducts.SUsaGoldenPromise,), states=()),
    'sagicor': ProductCarrierMetadata(display_name='Sagicor', products=(_TermProducts.SagicorSageTerm,), states=()),
    'sbli': ProductCarrierMetadata(display_name='SBLI', products=(_FexProducts.SbliLivingLegacy, _TermProducts.SbliTTerm,), states=()),
    'securico-life': ProductCarrierMetadata(display_name='Securico Life', products=(_FexProducts.SecuricoLifeFinalExpense,), states=()),
    'security-national': ProductCarrierMetadata(display_name='Security National', products=(_FexProducts.SecurityNationalSimpleSecurity,), states=()),
    'senior-life': ProductCarrierMetadata(display_name='Senior Life', products=(_TermProducts.SeniorLifeTermLife, _FexProducts.SeniorLifeWholeLife,), states=()),
    'sentinel-security': ProductCarrierMetadata(display_name='Sentinel Security', products=(_FexProducts.SentinelSecurityNewVantage,), states=()),
    'sons-of-norway': ProductCarrierMetadata(display_name='Sons of Norway', products=(_FexProducts.SonsOfNorwayLegacySure, _FexProducts.SonsOfNorwayWholeLife,), states=()),
    'transamerica': ProductCarrierMetadata(display_name='TransAmerica', products=(_FexProducts.TransamericaFeExpressSolution, _TermProducts.TransamericaTrendsetterSuper, _TermProducts.TransamericaTrendsetterLb, _FexProducts.TransamericaSolution,), states=()),
    'trinity': ProductCarrierMetadata(display_name='Trinity', products=(_FexProducts.TrinityGoldenEagle,), states=()),
    'united-farm-and-family': ProductCarrierMetadata(display_name='United Farm And Family', products=(_FexProducts.UnitedFarmAndFamilyWholeLife,), states=()),
    'united-home-life': ProductCarrierMetadata(display_name='United Home Life', products=(_FexProducts.UnitedHomeLifeWholeLife,), states=()),
    'william-penn': ProductCarrierMetadata(display_name='William Penn', products=(_TermProducts.WilliamPennOpterm,), states=()),
}

_ALL_CARRIERS: tuple[str, ...] = ('aetna', 'aetna-accendo', 'aflac', 'american-amicable', 'american-home-life', 'americo', 'ameritas', 'baltimore-life', 'banner', 'betterlife', 'centrian', 'cica-life', 'cigna', 'combined', 'corebridge', 'emc', 'everest-ia-american', 'family-benefit-life', 'fidelity-life', 'first-guaranty-insurance', 'foresters', 'gerber', 'global-atlantic', 'gpm', 'gpm-life', 'gtl', 'hero-life', 'illinois-mutual', 'john-hancock', 'kansas-city-life', 'kskj', 'liberty-bankers', 'life-shield', 'lincoln', 'manhattan-life', 'mutual-of-omaha', 'nationwide', 'newbridge', 'north-american', 'occidental-life', 'oxford-life', 'pekin', 'pioneer-american', 'prosperity', 'protective-life', 'prudential', 'royal-arcanum', 'royal-neighbors', 's-usa', 'sagicor', 'sbli', 'securico-life', 'security-national', 'senior-life', 'sentinel-security', 'sons-of-norway', 'transamerica', 'trinity', 'united-farm-and-family', 'united-home-life', 'william-penn')


class _ProductCarriersAPI:
    """Catalog API for carriers."""

    __slots__ = ()

    def values(self) -> tuple[str, ...]:
        return _ALL_CARRIERS

    def metadata(self, c: str) -> ProductCarrierMetadata:
        m = _CARRIERS.get(c)
        if m is None:
            raise KeyError(f"ProductCarriers.metadata: unknown carrier {c!r}")
        return m


ProductCarriers = _ProductCarriersAPI()
