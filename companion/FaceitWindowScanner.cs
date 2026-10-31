using System.Diagnostics;
using System.Windows.Automation;

namespace CS2FaceitCompanion;

internal sealed class FaceitWindowScanner
{
    private const int MaximumElementsPerWindow = 6_000;
    private readonly string[] _processNameFragments;

    public FaceitWindowScanner(string[] processNameFragments)
    {
        _processNameFragments = processNameFragments;
    }

    public string? FindMatchId()
    {
        foreach (Process process in Process.GetProcesses())
        {
            using (process)
            {
                try
                {
                    if (process.MainWindowHandle == IntPtr.Zero ||
                        !_processNameFragments.Any(fragment =>
                            process.ProcessName.Contains(
                                fragment,
                                StringComparison.OrdinalIgnoreCase)))
                    {
                        continue;
                    }

                    string? matchId = ScanWindow(process.MainWindowHandle);
                    if (matchId is not null)
                    {
                        return matchId;
                    }
                }
                catch (Exception exception) when (
                    exception is InvalidOperationException or
                    System.ComponentModel.Win32Exception)
                {
                    CompanionLog.Write(
                        $"Could not inspect process {process.ProcessName}",
                        exception);
                }
            }
        }

        return null;
    }

    private static string? ScanWindow(IntPtr windowHandle)
    {
        AutomationElement root;

        try
        {
            root = AutomationElement.FromHandle(windowHandle);
        }
        catch (ElementNotAvailableException)
        {
            return null;
        }

        Queue<AutomationElement> pending = new();
        pending.Enqueue(root);
        int inspectedElements = 0;

        while (pending.Count > 0 && inspectedElements < MaximumElementsPerWindow)
        {
            AutomationElement element = pending.Dequeue();
            inspectedElements++;

            if (TryExtractFromCurrentFaceitDocument(element, out string? matchId))
            {
                return matchId;
            }

            try
            {
                AutomationElement? child =
                    TreeWalker.ControlViewWalker.GetFirstChild(element);

                while (child is not null)
                {
                    pending.Enqueue(child);
                    child = TreeWalker.ControlViewWalker.GetNextSibling(child);
                }
            }
            catch (ElementNotAvailableException)
            {
                // The Electron view can replace nodes while navigating.
            }
        }

        return null;
    }

    private static bool TryExtractFromCurrentFaceitDocument(
        AutomationElement element,
        out string? matchId)
    {
        matchId = null;

        try
        {
            if (element.Current.ControlType != ControlType.Document ||
                !string.Equals(
                    element.Current.AutomationId,
                    "RootWebArea",
                    StringComparison.Ordinal))
            {
                return false;
            }

            if (element.TryGetCurrentPattern(
                    ValuePattern.Pattern,
                    out object? valuePatternObject) &&
                valuePatternObject is ValuePattern valuePattern)
            {
                return MatchIdExtractor.TryExtractFromCurrentFaceitPageUrl(
                    valuePattern.Current.Value,
                    out matchId);
            }
        }
        catch (ElementNotAvailableException)
        {
            return false;
        }
        catch (InvalidOperationException)
        {
            return false;
        }

        return false;
    }
}
