using System.IO;

namespace CS2FaceitCompanion;

internal static class CompanionLog
{
    private static readonly object Sync = new();

    public static void Write(string message, Exception? exception = null)
    {
        try
        {
            string directory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CS2FaceitTools");
            Directory.CreateDirectory(directory);

            string logPath = Path.Combine(directory, "companion.log");
            string line = $"{DateTimeOffset.Now:O} {message}";
            if (exception is not null)
            {
                line += $" | {exception.GetType().Name}: {exception.Message}";
            }

            lock (Sync)
            {
                File.AppendAllText(logPath, line + Environment.NewLine);
            }
        }
        catch
        {
            // Logging must never stop the companion.
        }
    }
}
