// Shared test fixtures: canonical applicants matching the project's
// persona discipline (api-standards.md §13). John Doe is the
// primary; Jane Smith is the secondary.
namespace Sah.Sdk.Zyins.Tests;

internal static class Fixtures
{
    public static Applicant JohnDoe() => new()
    {
        Dob = "1962-04-18",
        Sex = Sex.Male,
        HeightInches = 70,
        WeightPounds = 195,
        State = "NC",
        Zip = "27514",
        NicotineUse = NicotineUsage.None,
    };

    public static Applicant JaneSmith() => new()
    {
        Dob = "1985-11-02",
        Sex = Sex.Female,
        HeightInches = 65,
        WeightPounds = 140,
        State = "CA",
        Zip = "94110",
        NicotineUse = NicotineUsage.None,
    };

    public static PrequalifyInput JohnDoePrequalifyInput() => new()
    {
        Applicant = JohnDoe(),
        Coverage = Coverage.ByFaceValue(50_000),
        Products = new[] { new Product("colonial-penn", "cp-senior-life") },
    };

    public const string SampleToken = "isa_test_4fjK2nQ7mX1aB8sR9pZ3";
    public const string SampleRequestId = "req_01HZK2N5GQR9T8X4B6FJW3Y1AS";
    public const string SampleSessionSecret = "test_session_secret_for_hmac_only";
}
