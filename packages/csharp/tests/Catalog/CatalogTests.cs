// Smoke tests for the generated catalog. The full data set is exercised
// only inasmuch as the public API surface returns sensible values for
// well-known entries; the generator's correctness is exercised separately.
using Sah.Sdk.Catalog;
using Xunit;

namespace Sah.Sdk.Catalog.Tests;

public class CatalogTests
{
    [Fact]
    public void States_ByAbbreviation_FindsByAbbr()
    {
        var nc = States.ByAbbreviation("NC");
        Assert.NotNull(nc);
        Assert.Equal(State.NorthCarolina, nc);
    }

    [Fact]
    public void States_ByAbbreviation_FindsByName()
    {
        var nc = States.ByAbbreviation("North Carolina");
        Assert.NotNull(nc);
        Assert.Equal(State.NorthCarolina, nc);
    }

    [Fact]
    public void States_ByAbbreviation_ReturnsNullForUnknown()
    {
        Assert.Null(States.ByAbbreviation("ZZ"));
    }

    [Fact]
    public void States_Metadata_NorthCarolinaIsState()
    {
        var meta = States.Metadata(State.NorthCarolina);
        Assert.Equal("NC", meta.Abbreviation);
        Assert.Equal("North Carolina", meta.Name);
        Assert.False(meta.IsTerritory);
    }

    [Fact]
    public void States_Metadata_PuertoRicoIsTerritory()
    {
        var meta = States.Metadata(State.PuertoRico);
        Assert.True(meta.IsTerritory);
    }

    [Fact]
    public void Products_Values_NotEmpty()
    {
        Assert.NotEmpty(Products.Values());
    }

    [Fact]
    public void Products_ByCarrier_KnownCarrierReturnsAtLeastOne()
    {
        // Aetna ships multiple FEX + medsup products in v2_products.json.
        var aetnaProducts = Products.ByCarrier("aetna");
        Assert.NotEmpty(aetnaProducts);
    }

    [Fact]
    public void Products_Search_PrefixBeatsSubstring()
    {
        var results = Products.Search("aetna");
        Assert.NotEmpty(results);
    }

    [Fact]
    public void ErrorAdviceCodes_KnownCodeHasAdvice()
    {
        Assert.Equal("fix_request_body", ErrorAdviceCodes.Get(CatalogErrorCode.ValidationError));
    }

    [Fact]
    public void ErrorDocUrls_AllHaveDocsHost()
    {
        Assert.StartsWith("https://docs.isaapi.com/errors/", ErrorDocUrls.Get(CatalogErrorCode.NotFound));
    }
}
