// Time source facade. Direct calls to DateTime.UtcNow are forbidden in
// the SDK; every component takes an IClock so tests can pin time.
namespace Sah.Sdk.Core;

/// <summary>Injectable time source. Default is <see cref="SystemClock"/>.</summary>
public interface IClock
{
    /// <summary>Current UTC instant.</summary>
    DateTimeOffset UtcNow();
}

/// <summary>The production clock that reads the OS wall clock.</summary>
public sealed class SystemClock : IClock
{
    /// <summary>Process-wide singleton; allocation-free.</summary>
    public static readonly SystemClock Instance = new();

    private SystemClock() { }

    /// <inheritdoc />
    public DateTimeOffset UtcNow() => DateTimeOffset.UtcNow;
}

/// <summary>Test clock: returns a pinned instant; mutable via <see cref="Set"/>.</summary>
public sealed class FixedClock : IClock
{
    private DateTimeOffset _now;

    /// <summary>Construct with a starting instant.</summary>
    public FixedClock(DateTimeOffset now) => _now = now;

    /// <summary>Advance or rewind the pinned instant.</summary>
    public void Set(DateTimeOffset now) => _now = now;

    /// <inheritdoc />
    public DateTimeOffset UtcNow() => _now;
}
