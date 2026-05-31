// Shared credential state for license-mode `Isa` instances. The shared
// object is mutated in place when `Licenses.ActivateAsync()` returns a
// fresh license key; every downstream sub-client observes the new value
// without re-bootstrap because they all hold the same reference.
//
// Persistence is driven through `ICredentialStore` (passed via `Isa`
// construction). The store is the source of truth across process boots;
// the in-memory state is the source of truth within one process so
// per-call AsyncStorage round-trips stay off the hot path.
using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace Isa.Sdk.Zyins;

/// <summary>Pluggable credential store. Backs the shared <see cref="IsaCredentialState"/>
/// so license keys survive across process boots when the host provides a durable
/// adapter (e.g. AsyncStorage on React Native, the secret-service on Linux).
/// The default in-process implementation is <see cref="InMemoryCredentialStore"/>.</summary>
public interface ICredentialStore
{
    /// <summary>Get a value previously written via <see cref="SetAsync"/>. Returns null when
    /// the key has not been written or has been cleared via <see cref="RemoveAsync"/>.</summary>
    Task<string?> GetAsync(string key, CancellationToken ct = default);

    /// <summary>Upsert a value. Implementations MUST persist to durable storage
    /// before returning; the SDK relies on this guarantee for license-key durability.</summary>
    Task SetAsync(string key, string value, CancellationToken ct = default);

    /// <summary>Clear a previously stashed value. A no-op when the key is unset.</summary>
    Task RemoveAsync(string key, CancellationToken ct = default);
}

/// <summary>Canonical storage keys used by the SDK. Stable strings — consumers
/// of <see cref="ICredentialStore"/> can read them out-of-band.</summary>
public static class CredentialKeys
{
    /// <summary>License key written by <see cref="LicenseSubClient.ActivateAsync(LicenseActivateRequest, CancellationToken)"/>.</summary>
    public const string LicenseKey = "isa.licenseKey";

    /// <summary>Persisted device-id minted on first run.</summary>
    public const string DeviceId = "isa.deviceId";
}

/// <summary>In-process credential store. Not durable across restarts; provided
/// as the default so callers who haven't wired durable storage still get a
/// functional surface within one process. Thread-safe.</summary>
public sealed class InMemoryCredentialStore : ICredentialStore
{
    private readonly ConcurrentDictionary<string, string> _values = new();

    /// <inheritdoc />
    public Task<string?> GetAsync(string key, CancellationToken ct = default) =>
        Task.FromResult(_values.TryGetValue(key, out var v) ? v : null);

    /// <inheritdoc />
    public Task SetAsync(string key, string value, CancellationToken ct = default)
    {
        _values[key] = value;
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task RemoveAsync(string key, CancellationToken ct = default)
    {
        _values.TryRemove(key, out _);
        return Task.CompletedTask;
    }
}

/// <summary>Event payload fired when the SDK observes a fresh license key
/// (typically the return value of <see cref="LicenseSubClient.ActivateAsync(LicenseActivateRequest, CancellationToken)"/>).
/// Consumers wire this to UI banners, analytics, or invalidation
/// triggers.</summary>
public sealed record LicenseRefreshedEvent
{
    /// <summary>Fresh license key the SDK stashed.</summary>
    public required string LicenseKey { get; init; }

    /// <summary>Device id signed under for this activation.</summary>
    public required string DeviceId { get; init; }

    /// <summary>Email the activation was bound to.</summary>
    public required string Email { get; init; }

    /// <summary>Order id paired with the license key.</summary>
    public required string OrderId { get; init; }
}

/// <summary>Holds the shared license credentials and an event channel for
/// <c>OnLicenseRefreshed</c>. One instance per license-mode <see cref="Isa"/>.</summary>
public sealed class IsaCredentialState
{
    private readonly ICredentialStore _store;
    private readonly object _lock = new();
    private string _licenseKey = string.Empty;
    // The listener set is intentionally a copy-on-write list — refresh
    // events are rare, listener removal must not race a concurrent fire.
    private System.Collections.Generic.List<Action<LicenseRefreshedEvent>> _listeners
        = new();

    /// <summary>Login email. Stable for the lifetime of the state.</summary>
    public string Email { get; }

    /// <summary>Order id (defaults to keycode when unspecified).</summary>
    public string OrderId { get; }

    /// <summary>Persisted device id.</summary>
    public string DeviceId { get; }

    /// <summary>Current license key. Empty until activation; mutated in place
    /// by <see cref="RefreshLicenseKeyAsync"/> on successful activate.</summary>
    public string LicenseKey
    {
        get
        {
            lock (_lock)
            {
                return _licenseKey;
            }
        }
        private set
        {
            lock (_lock)
            {
                _licenseKey = value ?? string.Empty;
            }
        }
    }

    /// <summary>Construct from a credential snapshot + store.</summary>
    public IsaCredentialState(string email, string orderId, string deviceId, string licenseKey, ICredentialStore store)
    {
        if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("email required", nameof(email));
        if (string.IsNullOrWhiteSpace(orderId)) throw new ArgumentException("orderId required", nameof(orderId));
        if (string.IsNullOrWhiteSpace(deviceId)) throw new ArgumentException("deviceId required", nameof(deviceId));
        Email = email;
        OrderId = orderId;
        DeviceId = deviceId;
        LicenseKey = licenseKey ?? string.Empty;
        _store = store ?? throw new ArgumentNullException(nameof(store));
    }

    /// <summary>Subscribe to <c>OnLicenseRefreshed</c>. The returned action
    /// detaches the listener — call it to unsubscribe.</summary>
    public Action OnLicenseRefreshed(Action<LicenseRefreshedEvent> listener)
    {
        if (listener is null) throw new ArgumentNullException(nameof(listener));
        lock (_lock)
        {
            var next = new System.Collections.Generic.List<Action<LicenseRefreshedEvent>>(_listeners) { listener };
            _listeners = next;
        }
        return () =>
        {
            lock (_lock)
            {
                var next = new System.Collections.Generic.List<Action<LicenseRefreshedEvent>>(_listeners);
                next.Remove(listener);
                _listeners = next;
            }
        };
    }

    /// <summary>Update the in-memory license key, persist it, and fire
    /// the refresh event. Listener exceptions are swallowed — observer
    /// failures must not break activation.</summary>
    public async Task RefreshLicenseKeyAsync(string licenseKey, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(licenseKey))
            throw new ArgumentException("licenseKey must be non-empty", nameof(licenseKey));
        LicenseKey = licenseKey;
        await _store.SetAsync(CredentialKeys.LicenseKey, licenseKey, ct).ConfigureAwait(false);
        var evt = new LicenseRefreshedEvent
        {
            LicenseKey = licenseKey,
            DeviceId = DeviceId,
            Email = Email,
            OrderId = OrderId,
        };
        System.Collections.Generic.List<Action<LicenseRefreshedEvent>> snapshot;
        lock (_lock)
        {
            snapshot = _listeners;
        }
        foreach (var l in snapshot)
        {
            try { l(evt); } catch { /* swallow — observer failures must not break activate */ }
        }
    }

    /// <summary>Clear the stashed license key (post-deactivate).</summary>
    public async Task ClearLicenseKeyAsync(CancellationToken ct = default)
    {
        LicenseKey = string.Empty;
        await _store.RemoveAsync(CredentialKeys.LicenseKey, ct).ConfigureAwait(false);
    }
}
