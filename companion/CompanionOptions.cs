using System.Text.Json;
using System.IO;

namespace CS2FaceitCompanion;

internal sealed class CompanionOptions
{
    public string DashboardUrl { get; init; } = "http://localhost:3000/";

    public string FaceitApiBaseUrl { get; init; } = "";

    public string[] FaceitProcessNames { get; init; } = ["FACEIT"];

    public int ScanIntervalMilliseconds { get; init; } = 1500;

    public string OverlayHotkey { get; init; } = "Oemtilde";

    public bool StartMinimized { get; init; }

    public Keys GetOverlayHotkey()
    {
        return Enum.Parse<Keys>(OverlayHotkey, ignoreCase: true);
    }

    public static CompanionOptions Load()
    {
        string settingsPath = Path.Combine(
            AppContext.BaseDirectory,
            "companion.settings.json");

        if (!File.Exists(settingsPath))
        {
            return new CompanionOptions();
        }

        string json = File.ReadAllText(settingsPath);
        CompanionOptions options = JsonSerializer.Deserialize<CompanionOptions>(
            json,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            }) ?? throw new InvalidOperationException("The companion settings file is empty.");

        if (!Uri.TryCreate(options.DashboardUrl, UriKind.Absolute, out Uri? dashboard) ||
            (dashboard.Scheme != Uri.UriSchemeHttp &&
             dashboard.Scheme != Uri.UriSchemeHttps))
        {
            throw new InvalidOperationException(
                "DashboardUrl must be an absolute HTTP or HTTPS URL.");
        }

        if (!string.IsNullOrWhiteSpace(options.FaceitApiBaseUrl))
        {
            if (!Uri.TryCreate(
                    options.FaceitApiBaseUrl,
                    UriKind.Absolute,
                    out Uri? faceitApi) ||
                (faceitApi.Scheme != Uri.UriSchemeHttps &&
                 !(faceitApi.Scheme == Uri.UriSchemeHttp && faceitApi.IsLoopback)))
            {
                throw new InvalidOperationException(
                    "FaceitApiBaseUrl must use HTTPS, except for local development.");
            }
        }

        if (options.ScanIntervalMilliseconds is < 500 or > 60_000)
        {
            throw new InvalidOperationException(
                "ScanIntervalMilliseconds must be between 500 and 60000.");
        }

        if (options.FaceitProcessNames.Length == 0)
        {
            throw new InvalidOperationException(
                "FaceitProcessNames must contain at least one process name fragment.");
        }

        if (!Enum.TryParse(options.OverlayHotkey, ignoreCase: true, out Keys hotkey) ||
            hotkey == Keys.None)
        {
            throw new InvalidOperationException(
                "OverlayHotkey must be a valid Windows Forms key name.");
        }

        return options;
    }
}
