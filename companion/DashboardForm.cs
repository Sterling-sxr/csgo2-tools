using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace CS2FaceitCompanion;

internal sealed class DashboardForm : Form
{
    private const int CompactWidth = 500;
    private const int ExpandedWidth = 1380;
    private const int DashboardHeight = 800;
    private const int CornerRadius = 34;
    private const int WmNcButtonDown = 0x00A1;
    private const int HtCaption = 2;
    private readonly DashboardServer _dashboardServer;
    private readonly WebView2 _webView;
    private Uri? _pendingAddress;
    private bool _webViewReady;
    private bool _matchPanelExpanded;

    public DashboardForm(DashboardServer dashboardServer)
    {
        _dashboardServer = dashboardServer;
        string version = typeof(DashboardForm).Assembly
            .GetName()
            .Version?.ToString(3) ?? "0.1.0";
        Text = $"CS2 FACEIT Tools v{version}";
        Width = CompactWidth;
        Height = DashboardHeight;
        MinimumSize = new Size(460, 560);
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.FromArgb(232, 237, 243);
        FormBorderStyle = FormBorderStyle.None;
        DoubleBuffered = true;

        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.FromArgb(232, 237, 243),
        };

        Controls.Add(_webView);

        Load += (_, _) => PositionCompactWindow();
        Shown += async (_, _) => await InitializeWebViewAsync();
        FormClosing += OnFormClosing;
    }

    public bool AllowClose { get; set; }
    public event Action? DashboardResetRequested;
    public event Action<string>? MatchOverlayRequested;
    public event Action? AppSettingsRequested;
    public event Action<string>? AppSettingsSaveRequested;

    public void SendAppSettings(AppPreferences preferences, string? error = null)
    {
        if (!_webViewReady || _webView.CoreWebView2 is null)
        {
            return;
        }

        string payload = JsonSerializer.Serialize(new
        {
            type = "app-settings",
            overlayHotkey = preferences.OverlayHotkey,
            darkMode = preferences.DarkMode,
            error,
        });
        _webView.CoreWebView2.PostWebMessageAsJson(payload);
    }

    public void NavigateToMatch(string matchId)
    {
        SetMatchPanelExpanded(true);
        Uri address = DashboardAddress.ForMatch(
            _dashboardServer.DashboardUri.ToString(),
            matchId);
        Navigate(address);
        ShowDashboard();
    }

    public void ShowDashboard()
    {
        if (!Visible)
        {
            Show();
        }

        if (WindowState == FormWindowState.Minimized)
        {
            WindowState = FormWindowState.Normal;
        }

        Activate();
        BringToFront();
    }

    private async Task InitializeWebViewAsync()
    {
        if (_webViewReady)
        {
            return;
        }

        try
        {
            await _dashboardServer.EnsureRunningAsync();

            string userDataDirectory = Path.Combine(
                Environment.GetFolderPath(
                    Environment.SpecialFolder.LocalApplicationData),
                "CS2FaceitTools",
                "WebView2");
            CoreWebView2Environment environment =
                await CoreWebView2Environment.CreateAsync(
                    userDataFolder: userDataDirectory);
            await _webView.EnsureCoreWebView2Async(environment);

            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            _webViewReady = true;

            Uri initialAddress = _pendingAddress ?? _dashboardServer.DashboardUri;
            _pendingAddress = null;
            _webView.CoreWebView2.Navigate(initialAddress.ToString());
        }
        catch (Exception exception)
        {
            CompanionLog.Write("Desktop dashboard initialization failed", exception);
            MessageBox.Show(
                "The desktop dashboard could not start.\n\n" +
                exception.Message,
                "CS2 FACEIT Tools",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private void Navigate(Uri address)
    {
        if (!_webViewReady || _webView.CoreWebView2 is null)
        {
            _pendingAddress = address;
            return;
        }

        _webView.CoreWebView2.Navigate(address.ToString());
    }

    private void OnNavigationCompleted(
        object? sender,
        CoreWebView2NavigationCompletedEventArgs eventArgs)
    {
        if (!eventArgs.IsSuccess)
        {
            CompanionLog.Write(
                $"Dashboard navigation failed: {eventArgs.WebErrorStatus}");
        }
    }

    private void OnWebMessageReceived(
        object? sender,
        CoreWebView2WebMessageReceivedEventArgs eventArgs)
    {
        try
        {
            string message = eventArgs.TryGetWebMessageAsString();

            if (message.StartsWith(
                    "show-match-overlay:",
                    StringComparison.Ordinal))
            {
                string? matchId = MatchIdExtractor.Extract(
                    message["show-match-overlay:".Length..]);
                if (matchId is not null)
                {
                    MatchOverlayRequested?.Invoke(matchId);
                }
                return;
            }

            if (message.StartsWith(
                    "save-app-settings:",
                    StringComparison.Ordinal))
            {
                AppSettingsSaveRequested?.Invoke(
                    message["save-app-settings:".Length..]);
                return;
            }

            switch (message)
            {
                case "expand-match-panel":
                    SetMatchPanelExpanded(true);
                    break;
                case "refresh-window":
                    SetMatchPanelExpanded(false);
                    Navigate(_dashboardServer.DashboardUri);
                    DashboardResetRequested?.Invoke();
                    break;
                case "minimize-window":
                    WindowState = FormWindowState.Minimized;
                    break;
                case "close-window":
                    Close();
                    break;
                case "drag-window":
                    BeginWindowDrag();
                    break;
                case "get-app-settings":
                    AppSettingsRequested?.Invoke();
                    break;
            }
        }
        catch (ArgumentException)
        {
            // Ignore messages that are not plain strings.
        }
    }

    private void PositionCompactWindow()
    {
        Rectangle workingArea = Screen.FromControl(this).WorkingArea;
        int expandedWidth = Math.Min(ExpandedWidth, workingArea.Width);
        int initialWidth = Math.Min(
            _matchPanelExpanded ? ExpandedWidth : CompactWidth,
            workingArea.Width);
        int height = Math.Min(DashboardHeight, workingArea.Height);
        int left = workingArea.Left + ((workingArea.Width - expandedWidth) / 2);
        int top = workingArea.Top + ((workingArea.Height - height) / 2);

        Bounds = new Rectangle(left, top, initialWidth, height);
    }

    private void SetMatchPanelExpanded(bool expanded)
    {
        if (_matchPanelExpanded == expanded && IsHandleCreated)
        {
            return;
        }

        _matchPanelExpanded = expanded;
        Rectangle workingArea = Screen.FromControl(this).WorkingArea;
        int targetWidth = Math.Min(
            expanded ? ExpandedWidth : CompactWidth,
            workingArea.Width);
        int targetHeight = Math.Min(DashboardHeight, workingArea.Height);
        int targetLeft = Math.Clamp(
            Left,
            workingArea.Left,
            workingArea.Right - targetWidth);
        int targetTop = Math.Clamp(
            Top,
            workingArea.Top,
            workingArea.Bottom - targetHeight);

        Bounds = new Rectangle(
            targetLeft,
            targetTop,
            targetWidth,
            targetHeight);
    }

    protected override void OnSizeChanged(EventArgs eventArgs)
    {
        base.OnSizeChanged(eventArgs);

        if (Width <= 0 || Height <= 0)
        {
            return;
        }

        using GraphicsPath path = new();
        int diameter = CornerRadius * 2;
        Rectangle arc = new(0, 0, diameter, diameter);
        path.AddArc(arc, 180, 90);
        arc.X = Width - diameter - 1;
        path.AddArc(arc, 270, 90);
        arc.Y = Height - diameter - 1;
        path.AddArc(arc, 0, 90);
        arc.X = 0;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();

        Region?.Dispose();
        Region = new Region(path);
    }

    private void BeginWindowDrag()
    {
        ReleaseCapture();
        SendMessage(Handle, WmNcButtonDown, (IntPtr)HtCaption, IntPtr.Zero);
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs eventArgs)
    {
        if (AllowClose || eventArgs.CloseReason == CloseReason.WindowsShutDown)
        {
            return;
        }

        eventArgs.Cancel = true;
        Hide();
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(
        IntPtr windowHandle,
        int message,
        IntPtr wordParameter,
        IntPtr longParameter);
}
