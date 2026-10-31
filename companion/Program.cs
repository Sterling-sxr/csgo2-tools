namespace CS2FaceitCompanion;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
        {
            return SelfTest.Run();
        }

        ApplicationConfiguration.Initialize();

        try
        {
            CompanionOptions options = CompanionOptions.Load();
            string? requestedMatch = GetArgumentValue(args, "--match");
            string? initialMatchId = MatchIdExtractor.Extract(requestedMatch);

            if (requestedMatch is not null && initialMatchId is null)
            {
                throw new ArgumentException(
                    "The --match value is not a valid FACEIT match ID.");
            }

            using CompanionApplicationContext context = new(options, initialMatchId);
            System.Windows.Forms.Application.Run(context);
            return 0;
        }
        catch (Exception exception)
        {
            CompanionLog.Write("Startup failed", exception);
            System.Windows.Forms.MessageBox.Show(
                $"CS2 FACEIT Companion could not start.\n\n{exception.Message}",
                "CS2 FACEIT Companion",
                System.Windows.Forms.MessageBoxButtons.OK,
                System.Windows.Forms.MessageBoxIcon.Error);
            return 1;
        }
    }

    private static string? GetArgumentValue(string[] args, string name)
    {
        int index = Array.FindIndex(
            args,
            argument => string.Equals(
                argument,
                name,
                StringComparison.OrdinalIgnoreCase));

        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
}
