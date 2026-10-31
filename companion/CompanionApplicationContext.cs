namespace CS2FaceitCompanion;

using System.Text.Json;

internal sealed class CompanionApplicationContext : ApplicationContext
{
    private readonly CompanionOptions _options;
    private readonly DashboardServer _dashboardServer;
    private readonly FaceitWindowScanner _scanner;
    private readonly DashboardForm _dashboardForm;
    private readonly MatchOverlayForm _matchOverlayForm;
    private readonly OverlayHotkeyListener _overlayHotkeyListener;
    private readonly AppPreferences _preferences;
    private readonly NotifyIcon _trayIcon;
    private readonly Icon _applicationIcon;
    private readonly ToolStripMenuItem _statusItem;
    private readonly System.Windows.Forms.Timer _scanTimer;
    private bool _scanInProgress;
    private string? _lastDetectedMatchId;

    public CompanionApplicationContext(
        CompanionOptions options,
        string? initialMatchId = null)
    {
        _options = options;
        _scanner = new FaceitWindowScanner(options.FaceitProcessNames);
        _dashboardServer = new DashboardServer(
            options.DashboardUrl,
            options.FaceitApiBaseUrl);
        _preferences = AppPreferences.Load(options.OverlayHotkey);
        _applicationIcon = LoadApplicationIcon();
        _dashboardForm = new DashboardForm(_dashboardServer);
        _dashboardForm.Icon = _applicationIcon;
        _matchOverlayForm = new MatchOverlayForm(_dashboardServer)
        {
            Icon = _applicationIcon,
        };
        _dashboardForm.MatchOverlayRequested += _matchOverlayForm.PrepareMatch;
        _dashboardForm.DashboardResetRequested += _matchOverlayForm.ClearMatch;
        _dashboardForm.AppSettingsRequested += SendAppSettings;
        _dashboardForm.AppSettingsSaveRequested += SaveAppSettings;
        _overlayHotkeyListener = new OverlayHotkeyListener(
            _preferences.GetOverlayHotkey())
        {
            ShouldHandle = () => _matchOverlayForm.HasMatch,
        };
        _overlayHotkeyListener.Pressed += OnOverlayHotkeyPressed;
        _overlayHotkeyListener.Released += OnOverlayHotkeyReleased;

        _statusItem = new ToolStripMenuItem("Waiting for FACEIT…")
        {
            Enabled = false,
        };

        ContextMenuStrip menu = new();
        menu.Items.Add(_statusItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Scan now", null, (_, _) => ScanNow());
        menu.Items.Add("Open dashboard", null, (_, _) => OpenDashboard());
        menu.Items.Add("Show match overlay", null, (_, _) => ShowMatchOverlay());
        menu.Items.Add("Hide match overlay", null, (_, _) => _matchOverlayForm.HideOverlay());
        menu.Items.Add("Exit", null, (_, _) => ExitThread());

        _trayIcon = new NotifyIcon
        {
            ContextMenuStrip = menu,
            Icon = _applicationIcon,
            Text = "CS2 FACEIT Companion",
            Visible = true,
        };
        _trayIcon.DoubleClick += (_, _) => OpenDashboard();

        _scanTimer = new System.Windows.Forms.Timer
        {
            Interval = options.ScanIntervalMilliseconds,
            Enabled = true,
        };
        _scanTimer.Tick += (_, _) => ScanNow();

        CompanionLog.Write("Companion started");

        if (!options.StartMinimized)
        {
            _dashboardForm.Show();
        }

        if (initialMatchId is not null)
        {
            _lastDetectedMatchId = initialMatchId;
            _dashboardForm.NavigateToMatch(initialMatchId);
            _matchOverlayForm.PrepareMatch(initialMatchId);
        }
    }

    protected override void ExitThreadCore()
    {
        _scanTimer.Stop();
        _scanTimer.Dispose();
        _overlayHotkeyListener.Dispose();
        _dashboardForm.AllowClose = true;
        _dashboardForm.Close();
        _dashboardForm.Dispose();
        _matchOverlayForm.AllowClose = true;
        _matchOverlayForm.Close();
        _matchOverlayForm.Dispose();
        _dashboardServer.Dispose();
        _trayIcon.Visible = false;
        _trayIcon.Dispose();
        _applicationIcon.Dispose();
        CompanionLog.Write("Companion stopped");
        base.ExitThreadCore();
    }

    private static Icon LoadApplicationIcon()
    {
        Icon? executableIcon = Icon.ExtractAssociatedIcon(
            System.Windows.Forms.Application.ExecutablePath);
        Icon applicationIcon = (Icon)(executableIcon ?? SystemIcons.Application).Clone();
        executableIcon?.Dispose();
        return applicationIcon;
    }

    private async void ScanNow()
    {
        if (_scanInProgress)
        {
            return;
        }

        _scanInProgress = true;

        try
        {
            string? matchId = await Task.Run(_scanner.FindMatchId);
            _statusItem.Text = matchId is null
                ? "Waiting for a FACEIT matchroom…"
                : $"Detected {matchId}";

            if (matchId is null || matchId == _lastDetectedMatchId)
            {
                return;
            }

            _lastDetectedMatchId = matchId;
            CompanionLog.Write($"Detected match {matchId}");
            _dashboardForm.NavigateToMatch(matchId);
            _matchOverlayForm.PrepareMatch(matchId);
            _trayIcon.ShowBalloonTip(
                3000,
                "FACEIT match detected",
                "Hold the ` / ~ key to view both team rosters.",
                ToolTipIcon.Info);
        }
        catch (Exception exception)
        {
            _statusItem.Text = "Scan failed — see companion.log";
            CompanionLog.Write("FACEIT window scan failed", exception);
        }
        finally
        {
            _scanInProgress = false;
        }
    }

    private void OpenDashboard()
    {
        _dashboardForm.ShowDashboard();
    }

    private void ShowMatchOverlay()
    {
        if (_matchOverlayForm.HasMatch)
        {
            _matchOverlayForm.ShowOverlay();
            return;
        }

        _trayIcon.ShowBalloonTip(
            2200,
            "No match selected",
            "Open a FACEIT match room before showing the overlay.",
            ToolTipIcon.Info);
    }

    private void OnOverlayHotkeyPressed()
    {
        CompanionLog.Write("Overlay hold key pressed");
        _matchOverlayForm.ShowOverlay();
    }

    private void OnOverlayHotkeyReleased()
    {
        CompanionLog.Write("Overlay hold key released");
        _matchOverlayForm.HideOverlay();
    }

    private void SendAppSettings()
    {
        _dashboardForm.SendAppSettings(_preferences);
    }

    private void SaveAppSettings(string json)
    {
        try
        {
            AppPreferencesUpdate update =
                JsonSerializer.Deserialize<AppPreferencesUpdate>(
                    json,
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                    }) ?? throw new InvalidOperationException(
                        "The settings payload was empty.");
            AppPreferences.ValidateHotkey(update.OverlayHotkey);
            _preferences.OverlayHotkey = update.OverlayHotkey;
            _preferences.DarkMode = update.DarkMode;
            _preferences.Save();
            _overlayHotkeyListener.UpdateHotkey(
                _preferences.GetOverlayHotkey());
            _dashboardForm.SendAppSettings(_preferences);
            CompanionLog.Write(
                $"App settings saved: hotkey={_preferences.OverlayHotkey}, " +
                $"darkMode={_preferences.DarkMode}");
        }
        catch (Exception exception)
        {
            CompanionLog.Write("Could not save app settings", exception);
            _dashboardForm.SendAppSettings(
                _preferences,
                exception.Message);
        }
    }
}
