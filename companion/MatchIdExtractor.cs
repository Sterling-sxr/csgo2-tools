using System.Text.RegularExpressions;

namespace CS2FaceitCompanion;

internal static class MatchIdExtractor
{
    private static readonly Regex MatchIdPattern = new(
        @"(?<![0-9a-f])1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9a-f])",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static string? Extract(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return null;
        }

        Match match = MatchIdPattern.Match(candidate);
        return match.Success ? match.Value : null;
    }

    public static string? ExtractFromCurrentRoomUrl(string? candidate)
    {
        return TryExtractFromCurrentFaceitPageUrl(candidate, out string? matchId)
            ? matchId
            : null;
    }

    public static bool TryExtractFromCurrentFaceitPageUrl(
        string? candidate,
        out string? matchId)
    {
        matchId = null;

        if (!Uri.TryCreate(candidate, UriKind.Absolute, out Uri? uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            !(string.Equals(uri.Host, "www.faceit.com", StringComparison.OrdinalIgnoreCase) ||
              string.Equals(uri.Host, "faceit.com", StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        string[] segments = uri.AbsolutePath
            .Split('/', StringSplitOptions.RemoveEmptyEntries);

        if (segments.Length != 4 ||
            !string.Equals(segments[1], "cs2", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(segments[2], "room", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        string? extractedMatchId = Extract(segments[3]);
        matchId = string.Equals(
            extractedMatchId,
            segments[3],
            StringComparison.OrdinalIgnoreCase)
                ? extractedMatchId
                : null;
        return true;
    }
}
