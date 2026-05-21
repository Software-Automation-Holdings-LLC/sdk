"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - insurance/v2_products.json
from __future__ import annotations

from dataclasses import dataclass

from .products import Product


@dataclass(frozen=True, slots=True)
class ProductCarrierMetadata:
    """Public metadata for a single carrier."""

    display_name: str
    products: tuple[Product, ...]
    #: ISO 2-letter state codes the carrier is licensed in. Empty today.
    states: tuple[str, ...]


_CARRIERS: dict[str, ProductCarrierMetadata] = {
    'aetna': ProductCarrierMetadata(display_name='Aetna', products=tuple(Product(s) for s in ['fex-aetna-accendo', 'fex-aetna-protection-series', 'medsup-aetna-medsup']), states=()),
    'aetna-accendo': ProductCarrierMetadata(display_name='Aetna Accendo', products=tuple(Product(s) for s in ['medsup-aetna-accendo-medsup']), states=()),
    'aflac': ProductCarrierMetadata(display_name='Aflac', products=tuple(Product(s) for s in ['fex-aflac-final-expense']), states=()),
    'american-amicable': ProductCarrierMetadata(display_name='American Amicable', products=tuple(Product(s) for s in ['fex-american-amicable-clear-choice', 'fex-american-amicable-dignity-solutions', 'fex-american-amicable-golden-solution', 'fex-american-amicable-innovative-solutions', 'fex-american-amicable-platinum-solution-legacy-plan', 'fex-american-amicable-senior-choice', 'fex-american-amicable-tribute', 'term-american-amicable-easy-term', 'term-american-amicable-home-protector', 'term-american-amicable-term-made-simple']), states=()),
    'american-home-life': ProductCarrierMetadata(display_name='American Home Life', products=tuple(Product(s) for s in ['fex-american-home-life-guidestar', 'fex-american-home-life-patriot-series']), states=()),
    'americo': ProductCarrierMetadata(display_name='Americo', products=tuple(Product(s) for s in ['fex-americo-eagle-premier', 'term-americo-hms-plus']), states=()),
    'ameritas': ProductCarrierMetadata(display_name='Ameritas', products=tuple(Product(s) for s in ['term-ameritas-flx-living-benefits-term', 'term-ameritas-value-plus-term']), states=()),
    'baltimore-life': ProductCarrierMetadata(display_name='Baltimore Life', products=tuple(Product(s) for s in ['fex-baltimore-life-iprovide', 'fex-baltimore-life-silver-guard']), states=()),
    'banner': ProductCarrierMetadata(display_name='Banner', products=tuple(Product(s) for s in ['term-banner-opterm']), states=()),
    'betterlife': ProductCarrierMetadata(display_name='BetterLife', products=tuple(Product(s) for s in ['fex-betterlife-final-expense', 'preneed-betterlife-single-premium']), states=()),
    'centrian': ProductCarrierMetadata(display_name='Centrian', products=tuple(Product(s) for s in ['fex-centrian-living-legacy']), states=()),
    'cica-life': ProductCarrierMetadata(display_name='CICA Life', products=tuple(Product(s) for s in ['fex-cica-life-superior-choice']), states=()),
    'cigna': ProductCarrierMetadata(display_name='Cigna', products=tuple(Product(s) for s in ['fex-cigna-individual-whole-life']), states=()),
    'combined': ProductCarrierMetadata(display_name='Combined', products=tuple(Product(s) for s in ['fex-combined-generational-life']), states=()),
    'corebridge': ProductCarrierMetadata(display_name='Corebridge', products=tuple(Product(s) for s in ['fex-corebridge-giwl', 'fex-corebridge-simplinow-legacy', 'term-corebridge-select-a-term']), states=()),
    'emc': ProductCarrierMetadata(display_name='EMC', products=tuple(Product(s) for s in ['fex-emc-easylife']), states=()),
    'everest-ia-american': ProductCarrierMetadata(display_name='Everest IA American', products=tuple(Product(s) for s in ['fex-everest-ia-american-advantage-50-plus']), states=()),
    'family-benefit-life': ProductCarrierMetadata(display_name='Family Benefit Life', products=tuple(Product(s) for s in ['fex-family-benefit-life-golden-eagle']), states=()),
    'fidelity-life': ProductCarrierMetadata(display_name='Fidelity Life', products=tuple(Product(s) for s in ['fex-fidelity-life-rapidecision', 'fex-fidelity-life-rapidecision-senior-life', 'term-fidelity-life-instabrain-term', 'term-fidelity-life-instaterm']), states=()),
    'first-guaranty-insurance': ProductCarrierMetadata(display_name='First Guaranty Insurance', products=tuple(Product(s) for s in ['fex-first-guaranty-insurance-security-care']), states=()),
    'foresters': ProductCarrierMetadata(display_name='Foresters', products=tuple(Product(s) for s in ['fex-foresters-plan-right', 'term-foresters-strong-foundation', 'term-foresters-your-term', 'term-foresters-your-term-non-medical']), states=()),
    'gerber': ProductCarrierMetadata(display_name='Gerber', products=tuple(Product(s) for s in ['fex-gerber-life']), states=()),
    'global-atlantic': ProductCarrierMetadata(display_name='Global Atlantic', products=tuple(Product(s) for s in ['preneed-global-atlantic-simple-protection-plan']), states=()),
    'gpm': ProductCarrierMetadata(display_name='GPM', products=tuple(Product(s) for s in ['term-gpm-q-mark']), states=()),
    'gpm-life': ProductCarrierMetadata(display_name='GPM Life', products=tuple(Product(s) for s in ['fex-gpm-life-secure-mark']), states=()),
    'gtl': ProductCarrierMetadata(display_name='GTL', products=tuple(Product(s) for s in ['fex-gtl-heritage-plan', 'term-gtl-turbo-term']), states=()),
    'hero-life': ProductCarrierMetadata(display_name='Hero Life', products=tuple(Product(s) for s in ['term-hero-life-term']), states=()),
    'illinois-mutual': ProductCarrierMetadata(display_name='Illinois Mutual', products=tuple(Product(s) for s in ['fex-illinois-mutual-path-protector-plus']), states=()),
    'john-hancock': ProductCarrierMetadata(display_name='John Hancock', products=tuple(Product(s) for s in ['term-john-hancock-simple-term-with-vitality']), states=()),
    'kansas-city-life': ProductCarrierMetadata(display_name='Kansas City Life', products=tuple(Product(s) for s in ['term-kansas-city-life-signature-term-express']), states=()),
    'kskj': ProductCarrierMetadata(display_name='KSKJ', products=tuple(Product(s) for s in ['fex-kskj-final-expense']), states=()),
    'liberty-bankers': ProductCarrierMetadata(display_name='Liberty Bankers', products=tuple(Product(s) for s in ['fex-liberty-bankers-simpl']), states=()),
    'life-shield': ProductCarrierMetadata(display_name='Life Shield', products=tuple(Product(s) for s in ['fex-life-shield-survivor']), states=()),
    'lincoln': ProductCarrierMetadata(display_name='Lincoln', products=tuple(Product(s) for s in ['term-lincoln-lifeelements', 'term-lincoln-termaccel']), states=()),
    'manhattan-life': ProductCarrierMetadata(display_name='Manhattan Life', products=tuple(Product(s) for s in ['fex-manhattan-life-secure-advantage', 'medsup-manhattan-life-medsup']), states=()),
    'mutual-of-omaha': ProductCarrierMetadata(display_name='Mutual of Omaha', products=tuple(Product(s) for s in ['fex-mutual-of-omaha-living-promise', 'medsup-mutual-of-omaha-medsup', 'term-mutual-of-omaha-term-life-answers', 'term-mutual-of-omaha-term-life-express']), states=()),
    'nationwide': ProductCarrierMetadata(display_name='Nationwide', products=tuple(Product(s) for s in ['term-nationwide-yourlife']), states=()),
    'newbridge': ProductCarrierMetadata(display_name='Newbridge', products=tuple(Product(s) for s in ['fex-newbridge-final-expense']), states=()),
    'north-american': ProductCarrierMetadata(display_name='North American', products=tuple(Product(s) for s in ['term-north-american-addvantage']), states=()),
    'occidental-life': ProductCarrierMetadata(display_name='Occidental Life', products=tuple(Product(s) for s in ['fex-occidental-life-clear-choice', 'fex-occidental-life-dignity-solutions', 'fex-occidental-life-golden-solution', 'fex-occidental-life-innovative-solutions', 'fex-occidental-life-platinum-solution-legacy-plan', 'fex-occidental-life-senior-choice', 'fex-occidental-life-tribute']), states=()),
    'oxford-life': ProductCarrierMetadata(display_name='Oxford Life', products=tuple(Product(s) for s in ['fex-oxford-life-simplified-issue']), states=()),
    'pekin': ProductCarrierMetadata(display_name='Pekin', products=tuple(Product(s) for s in ['fex-pekin-whole-life']), states=()),
    'pioneer-american': ProductCarrierMetadata(display_name='Pioneer American', products=tuple(Product(s) for s in ['fex-pioneer-american-independent-american', 'fex-pioneer-american-northstar-legacy']), states=()),
    'prosperity': ProductCarrierMetadata(display_name='Prosperity', products=tuple(Product(s) for s in ['term-prosperity-family-freedom-term']), states=()),
    'protective-life': ProductCarrierMetadata(display_name='Protective Life', products=tuple(Product(s) for s in ['term-protective-life-classic-choice-term', 'term-protective-life-custom-choice-term']), states=()),
    'prudential': ProductCarrierMetadata(display_name='Prudential', products=tuple(Product(s) for s in ['term-prudential-essential-term-plus', 'term-prudential-essential-term-value']), states=()),
    'royal-arcanum': ProductCarrierMetadata(display_name='Royal Arcanum', products=tuple(Product(s) for s in ['fex-royal-arcanum-graded', 'fex-royal-arcanum-simplified-issue']), states=()),
    'royal-neighbors': ProductCarrierMetadata(display_name='Royal Neighbors', products=tuple(Product(s) for s in ['fex-royal-neighbors-ensured-legacy']), states=()),
    's-usa': ProductCarrierMetadata(display_name='S.USA', products=tuple(Product(s) for s in ['fex-s.usa-golden-promise']), states=()),
    'sagicor': ProductCarrierMetadata(display_name='Sagicor', products=tuple(Product(s) for s in ['term-sagicor-sage-term']), states=()),
    'sbli': ProductCarrierMetadata(display_name='SBLI', products=tuple(Product(s) for s in ['fex-sbli-living-legacy', 'term-sbli-t-term']), states=()),
    'securico-life': ProductCarrierMetadata(display_name='Securico Life', products=tuple(Product(s) for s in ['fex-securico-life-final-expense']), states=()),
    'security-national': ProductCarrierMetadata(display_name='Security National', products=tuple(Product(s) for s in ['fex-security-national-simple-security']), states=()),
    'senior-life': ProductCarrierMetadata(display_name='Senior Life', products=tuple(Product(s) for s in ['fex-senior-life-whole-life', 'term-senior-life-term-life']), states=()),
    'sentinel-security': ProductCarrierMetadata(display_name='Sentinel Security', products=tuple(Product(s) for s in ['fex-sentinel-security-new-vantage']), states=()),
    'sons-of-norway': ProductCarrierMetadata(display_name='Sons of Norway', products=tuple(Product(s) for s in ['fex-sons-of-norway-legacy-sure', 'fex-sons-of-norway-whole-life']), states=()),
    'transamerica': ProductCarrierMetadata(display_name='TransAmerica', products=tuple(Product(s) for s in ['fex-transamerica-fe-express-solution', 'fex-transamerica-solution', 'term-transamerica-trendsetter-lb', 'term-transamerica-trendsetter-super']), states=()),
    'trinity': ProductCarrierMetadata(display_name='Trinity', products=tuple(Product(s) for s in ['fex-trinity-golden-eagle']), states=()),
    'united-farm-and-family': ProductCarrierMetadata(display_name='United Farm And Family', products=tuple(Product(s) for s in ['fex-united-farm-and-family-whole-life']), states=()),
    'united-home-life': ProductCarrierMetadata(display_name='United Home Life', products=tuple(Product(s) for s in ['fex-united-home-life-whole-life']), states=()),
    'william-penn': ProductCarrierMetadata(display_name='William Penn', products=tuple(Product(s) for s in ['term-william-penn-opterm']), states=()),
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
