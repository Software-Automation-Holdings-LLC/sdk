// Pluggable source for the v3 reference bundle.
//
// The reference layer (Conditions/Medications/Concepts MatchAsync,
// autocomplete, fuzzy, autocorrect) is warmed by default from a live
// DatasetsV3.GetAsync HTTP call. An IDatasetSource lets the same layer load
// from a local artifact — offline, inside the engine, or anywhere a network
// round-trip is undesirable. The contract is a single
// LoadAsync(ct) → DatasetBundleV3; how the bytes arrive is the source's
// business.
//
// Three implementations ship:
//   - FileDatasetSource — read a file, parse with the EXISTING
//     DatasetsV3Parser.ParseEnvelope (no second parser).
//   - ApiDatasetSource — the current DatasetsV3.GetAsync HTTP path.
//   - ResolvingDatasetSource — try sources in order, first success wins.
//     Documented chain: local file → optional generate hook → API fallback.
//
// Default behavior is unchanged: with no DatasetSource option the client
// uses the API path exactly as before.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Isa.Sdk.Zyins;

/// <summary>Resolves a <see cref="DatasetBundleV3"/> for the reference
/// layer. Implementations resolve the bundle however they like — HTTP, a
/// local file, an in-memory value — and surface one method.</summary>
public interface IDatasetSource
{
  /// <summary>Resolve the bundle. Throws <see cref="DatasetSourceException"/>
  /// naming the source and the failing input when the bundle cannot be
  /// produced.</summary>
  Task<DatasetBundleV3> LoadAsync(CancellationToken ct = default);
}

/// <summary>Thrown when an <see cref="IDatasetSource"/> cannot resolve a
/// bundle.</summary>
public sealed class DatasetSourceException : Exception
{
  /// <summary>Construct with a descriptive message.</summary>
  public DatasetSourceException(string message) : base(message) { }

  /// <summary>Construct with a message and the underlying cause.</summary>
  public DatasetSourceException(string message, Exception inner) : base(message, inner) { }
}

/// <summary>Reads a file's text by path. Injectable so the file source
/// stays testable without touching the disk. The name describes WHAT (read
/// a file) not HOW (which API backs it).</summary>
public delegate Task<string> FileReader(string path, CancellationToken ct);

/// <summary>Loads the bundle from a local file and parses it with the
/// shared parser. Accepts the slim <c>reference-bundle.json</c> OR the full
/// <c>datasets.json</c> — both carry the same <c>data.datasets</c> shape;
/// the reference layer reads only the reference fields. The file has no
/// ETag, so the parsed bundle's <c>ETag</c> is null.</summary>
public sealed class FileDatasetSource : IDatasetSource
{
  private readonly string _path;
  private readonly FileReader _read;

  /// <summary>Construct a file-backed source reading from the OS
  /// filesystem.</summary>
  public FileDatasetSource(string path)
      : this(path, DefaultReadAsync) { }

  /// <summary>Construct with an injected reader (tests supply an in-memory
  /// reader).</summary>
  public FileDatasetSource(string path, FileReader read)
  {
    _path = path ?? throw new ArgumentNullException(nameof(path));
    _read = read ?? throw new ArgumentNullException(nameof(read));
  }

  /// <inheritdoc />
  public async Task<DatasetBundleV3> LoadAsync(CancellationToken ct = default)
  {
    string body;
    try
    {
      body = await _read(_path, ct).ConfigureAwait(false);
    }
    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
    {
      throw new DatasetSourceException($"FileDatasetSource: failed to read {_path}", ex);
    }
    try
    {
      return DatasetsV3Parser.ParseEnvelope(body, etag: null);
    }
    catch (Exception ex) when (ex is not DatasetSourceException)
    {
      throw new DatasetSourceException(
          $"FileDatasetSource: failed to parse {_path} as a v3 dataset bundle", ex);
    }
  }

  // The single filesystem call is isolated behind the injectable
  // FileReader facade so every other code path stays testable without
  // disk I/O.
  private static async Task<string> DefaultReadAsync(string path, CancellationToken ct)
  {
    ct.ThrowIfCancellationRequested();
    using var stream = new FileStream(
        path, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize: 4096, useAsync: true);
    using var reader = new StreamReader(stream, Encoding.UTF8);
    return await reader.ReadToEndAsync().ConfigureAwait(false);
  }
}

/// <summary>Loads the bundle from a caller-supplied fetcher — the current
/// DatasetsV3.GetAsync HTTP path. Uses the already-configured client
/// credential; it introduces no new service key.</summary>
public sealed class ApiDatasetSource : IDatasetSource
{
  private readonly Func<CancellationToken, Task<DatasetBundleV3>> _fetch;

  /// <summary>Wrap a bundle fetcher (typically a client's
  /// DatasetsV3.GetAsync) as a source.</summary>
  public ApiDatasetSource(Func<CancellationToken, Task<DatasetBundleV3>> fetch)
  {
    _fetch = fetch ?? throw new ArgumentNullException(nameof(fetch));
  }

  /// <inheritdoc />
  public Task<DatasetBundleV3> LoadAsync(CancellationToken ct = default) => _fetch(ct);
}

/// <summary>Serves a bundle already in memory.</summary>
public sealed class StaticDatasetSource : IDatasetSource
{
  private readonly DatasetBundleV3 _bundle;

  /// <summary>Wrap an in-memory bundle.</summary>
  public StaticDatasetSource(DatasetBundleV3 bundle)
  {
    _bundle = bundle ?? throw new ArgumentNullException(nameof(bundle));
  }

  /// <inheritdoc />
  public Task<DatasetBundleV3> LoadAsync(CancellationToken ct = default) => Task.FromResult(_bundle);
}

/// <summary>Tries each source in order; the first that resolves wins. The
/// documented chain is local file → optional generate hook → API fallback:
/// pass the generate hook as the <c>onMissing</c> constructor argument and
/// it runs once, after the first source fails and before the next is tried.
/// When every source fails, <see cref="LoadAsync"/> throws a
/// <see cref="DatasetSourceException"/> naming each attempt.</summary>
public sealed class ResolvingDatasetSource : IDatasetSource
{
  private readonly IReadOnlyList<IDatasetSource> _sources;
  private readonly Func<CancellationToken, Task>? _onMissing;

  /// <summary>Construct a chain. <paramref name="onMissing"/> may be
  /// null.</summary>
  public ResolvingDatasetSource(
      IReadOnlyList<IDatasetSource> sources,
      Func<CancellationToken, Task>? onMissing = null)
  {
    if (sources is null) throw new ArgumentNullException(nameof(sources));
    if (sources.Count == 0)
    {
      throw new DatasetSourceException(
          "ResolvingDatasetSource: at least one source is required");
    }
    _sources = sources;
    _onMissing = onMissing;
  }

  /// <inheritdoc />
  public async Task<DatasetBundleV3> LoadAsync(CancellationToken ct = default)
  {
    var failures = new List<string>(_sources.Count);
    for (var i = 0; i < _sources.Count; i++)
    {
      try
      {
        return await _sources[i].LoadAsync(ct).ConfigureAwait(false);
      }
      catch (Exception ex)
      {
        failures.Add($"{_sources[i].GetType().Name} failed ({ex.Message})");
      }
      if (i == 0 && _onMissing is not null)
      {
        await RunOnMissingAsync(failures, ct).ConfigureAwait(false);
      }
    }
    throw new DatasetSourceException(
        "ResolvingDatasetSource: every source failed — " + string.Join("; ", failures));
  }

  private async Task RunOnMissingAsync(List<string> failures, CancellationToken ct)
  {
    try
    {
      await _onMissing!(ct).ConfigureAwait(false);
    }
    catch (Exception ex)
    {
      failures.Add($"onMissing hook failed ({ex.Message})");
    }
  }
}
