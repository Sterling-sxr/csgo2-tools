using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;

namespace CS2FaceitCompanion;

internal sealed class DashboardServer : IDisposable
{
    private readonly Uri _dashboardUri;
    private readonly string _faceitApiBaseUrl;
    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(1),
    };
    private readonly SemaphoreSlim _startGate = new(1, 1);
    private Process? _serverProcess;

    public DashboardServer(string dashboardUrl, string faceitApiBaseUrl)
    {
        Uri configuredUri = new(dashboardUrl);
        _dashboardUri = configuredUri.IsLoopback && BundledServerAvailable()
            ? WithPort(configuredUri, FindAvailableLoopbackPort())
            : configuredUri;
        _faceitApiBaseUrl = faceitApiBaseUrl.Trim();
    }

    public Uri DashboardUri => _dashboardUri;

    public async Task EnsureRunningAsync()
    {
        await _startGate.WaitAsync();

        try
        {
            if (!IsLocalDashboard())
            {
                return;
            }

            if (await IsReachableAsync())
            {
                CompanionLog.Write("Using an existing local dashboard server");
                return;
            }

            StartBundledServer();

            DateTimeOffset deadline = DateTimeOffset.UtcNow.AddSeconds(30);
            while (DateTimeOffset.UtcNow < deadline)
            {
                if (_serverProcess?.HasExited == true)
                {
                    throw new InvalidOperationException(
                        $"The bundled dashboard server exited with code " +
                        $"{_serverProcess.ExitCode}.");
                }

                if (await IsReachableAsync())
                {
                    CompanionLog.Write("Bundled dashboard server is ready");
                    return;
                }

                await Task.Delay(250);
            }

            throw new TimeoutException(
                "The bundled dashboard server did not become ready within 30 seconds.");
        }
        finally
        {
            _startGate.Release();
        }
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        _startGate.Dispose();

        if (_serverProcess is null)
        {
            return;
        }

        try
        {
            if (!_serverProcess.HasExited)
            {
                _serverProcess.Kill(entireProcessTree: true);
                _serverProcess.WaitForExit(5000);
            }
        }
        catch (Exception exception)
        {
            CompanionLog.Write("Could not stop bundled dashboard server", exception);
        }
        finally
        {
            _serverProcess.Dispose();
        }
    }

    private bool IsLocalDashboard()
    {
        return _dashboardUri.IsLoopback;
    }

    private async Task<bool> IsReachableAsync()
    {
        try
        {
            using HttpResponseMessage response = await _httpClient.GetAsync(
                _dashboardUri,
                HttpCompletionOption.ResponseHeadersRead);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException)
        {
            return false;
        }
        catch (TaskCanceledException)
        {
            return false;
        }
    }

    private void StartBundledServer()
    {
        string webDirectory = Path.Combine(AppContext.BaseDirectory, "web");
        string nodePath = Path.Combine(webDirectory, "node.exe");
        string serverPath = Path.Combine(webDirectory, "server.js");

        if (!File.Exists(nodePath) || !File.Exists(serverPath))
        {
            throw new FileNotFoundException(
                "The bundled Next.js server is missing. Rebuild the Windows package " +
                "with scripts/publish-windows.ps1.");
        }

        ProcessStartInfo startInfo = new()
        {
            FileName = nodePath,
            Arguments = $"\"{serverPath}\"",
            WorkingDirectory = webDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        startInfo.Environment["NODE_ENV"] = "production";
        startInfo.Environment["HOSTNAME"] = "127.0.0.1";
        startInfo.Environment["PORT"] = EffectivePort().ToString();

        if (!string.IsNullOrWhiteSpace(_faceitApiBaseUrl))
        {
            startInfo.Environment["FACEIT_API_BASE_URL"] = _faceitApiBaseUrl;
        }

        _serverProcess = new Process
        {
            StartInfo = startInfo,
            EnableRaisingEvents = true,
        };
        _serverProcess.OutputDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrWhiteSpace(eventArgs.Data))
            {
                CompanionLog.Write($"Next.js: {eventArgs.Data}");
            }
        };
        _serverProcess.ErrorDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrWhiteSpace(eventArgs.Data))
            {
                CompanionLog.Write($"Next.js error: {eventArgs.Data}");
            }
        };

        if (!_serverProcess.Start())
        {
            throw new InvalidOperationException(
                "Windows could not start the bundled dashboard server.");
        }

        _serverProcess.BeginOutputReadLine();
        _serverProcess.BeginErrorReadLine();
        CompanionLog.Write(
            $"Started bundled dashboard server on port {EffectivePort()}");
    }

    private int EffectivePort()
    {
        return _dashboardUri.IsDefaultPort
            ? (_dashboardUri.Scheme == Uri.UriSchemeHttps ? 443 : 80)
            : _dashboardUri.Port;
    }

    private static bool BundledServerAvailable()
    {
        string webDirectory = Path.Combine(AppContext.BaseDirectory, "web");
        return File.Exists(Path.Combine(webDirectory, "node.exe")) &&
               File.Exists(Path.Combine(webDirectory, "server.js"));
    }

    private static int FindAvailableLoopbackPort()
    {
        TcpListener listener = new(IPAddress.Loopback, 0);
        listener.Start();

        try
        {
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        finally
        {
            listener.Stop();
        }
    }

    private static Uri WithPort(Uri uri, int port)
    {
        UriBuilder builder = new(uri)
        {
            Host = "127.0.0.1",
            Port = port,
        };
        return builder.Uri;
    }

}
