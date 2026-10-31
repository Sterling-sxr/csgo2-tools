using System.Text.Json;
using System.IO;

namespace CS2FaceitCompanion;

internal sealed class AppPreferences
{
    public string OverlayHotkey { get; set; } = "Oemtilde";
    public bool DarkMode { get; set; }

    public Keys GetOverlayHotkey()
    {
        return Enum.Parse<Keys>(OverlayHotkey, ignoreCase: true);
    }

    public static AppPreferences Load(string defaultHotkey)
    {
        string path = SettingsPath();
        if (!File.Exists(path))
        {
            return new AppPreferences { OverlayHotkey = defaultHotkey };
        }

        try
        {
            AppPreferences preferences = JsonSerializer.Deserialize<AppPreferences>(
                File.ReadAllText(path),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                new AppPreferences();
            ValidateHotkey(preferences.OverlayHotkey);
            return preferences;
        }
        catch (Exception exception)
        {
            CompanionLog.Write("Could not load app preferences", exception);
            return new AppPreferences { OverlayHotkey = defaultHotkey };
        }
    }

    public void Save()
    {
        ValidateHotkey(OverlayHotkey);
        string path = SettingsPath();
        string directory = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(directory);
        string temporaryPath = path + ".tmp";
        File.WriteAllText(
            temporaryPath,
            JsonSerializer.Serialize(
                this,
                new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporaryPath, path, overwrite: true);
    }

    public static void ValidateHotkey(string hotkey)
    {
        if (!Enum.TryParse(hotkey, ignoreCase: true, out Keys parsed) ||
            parsed == Keys.None)
        {
            throw new InvalidOperationException(
                "The selected overlay key is not supported.");
        }
    }

    private static string SettingsPath()
    {
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CS2FaceitTools",
            "preferences.json");
    }
}

internal sealed class AppPreferencesUpdate
{
    public string OverlayHotkey { get; init; } = "Oemtilde";
    public bool DarkMode { get; init; }
}
