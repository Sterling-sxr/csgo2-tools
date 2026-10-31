namespace CS2FaceitCompanion;

internal static class DashboardAddress
{
    public static Uri ForMatch(string dashboardUrl, string matchId)
    {
        UriBuilder builder = new(dashboardUrl);
        string existingQuery = builder.Query.TrimStart('?');
        string matchQuery = $"match={Uri.EscapeDataString(matchId)}&source=faceit-client";
        builder.Query = string.IsNullOrWhiteSpace(existingQuery)
            ? matchQuery
            : $"{existingQuery}&{matchQuery}";

        return builder.Uri;
    }
}
