namespace CS2FaceitCompanion;

internal static class SelfTest
{
    public static int Run()
    {
        const string expected = "1-0c87df5c-6270-48ca-b4f7-e1658fb5b0f1";

        (string? Input, string? Expected)[] cases =
        [
            ($"https://www.faceit.com/en/cs2/room/{expected}", expected),
            ($"Room {expected}?foo=bar", expected),
            (expected.ToUpperInvariant(), expected.ToUpperInvariant()),
            ("https://www.faceit.com/en/players/example", null),
            (null, null),
        ];

        foreach ((string? input, string? expectedValue) in cases)
        {
            string? actual = MatchIdExtractor.Extract(input);
            if (!string.Equals(actual, expectedValue, StringComparison.Ordinal))
            {
                CompanionLog.Write(
                    $"Self-test failed: expected '{expectedValue}', got '{actual}'");
                return 1;
            }
        }

        (string? Input, string? Expected)[] roomUrlCases =
        [
            ($"https://www.faceit.com/en/cs2/room/{expected}", expected),
            ($"https://www.faceit.com/en/cs2/room/{expected}?foo=bar", expected),
            ($"https://faceit.com/en/cs2/room/{expected}", expected),
            ($"https://www.faceit.com/en/matchmaking?room={expected}", null),
            ($"https://www.faceit.com/en/players/example/{expected}", null),
            ($"https://example.com/en/cs2/room/{expected}", null),
            ($"http://www.faceit.com/en/cs2/room/{expected}", null),
            (expected, null),
            (null, null),
        ];

        foreach ((string? input, string? expectedValue) in roomUrlCases)
        {
            string? actual = MatchIdExtractor.ExtractFromCurrentRoomUrl(input);
            if (!string.Equals(actual, expectedValue, StringComparison.Ordinal))
            {
                CompanionLog.Write(
                    $"Room URL self-test failed: expected '{expectedValue}', got '{actual}'");
                return 1;
            }
        }

        if (!MatchIdExtractor.TryExtractFromCurrentFaceitPageUrl(
                "https://www.faceit.com/en/matchmaking",
                out string? matchmakingMatchId) ||
            matchmakingMatchId is not null ||
            MatchIdExtractor.TryExtractFromCurrentFaceitPageUrl(
                "https://example.com/en/matchmaking",
                out _))
        {
            CompanionLog.Write("Current FACEIT page classification self-test failed");
            return 1;
        }

        CompanionLog.Write("Self-test passed");
        return 0;
    }
}
