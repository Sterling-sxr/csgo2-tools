using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.IO;
using System.Runtime.InteropServices;

namespace CS2FaceitCompanion;

internal sealed class MatchOverlayForm : Form
{
    private const int OverlayWidth = 1120;
    private const int OverlayHeight = 390;
    private const int WsExToolWindow = 0x00000080;
    private const int WsExNoActivate = 0x08000000;
    private const int WmNcLeftButtonDown = 0x00A1;
    private const int HitTestCaption = 0x0002;
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpShowWindow = 0x0040;
    private const uint SwpNoOwnerZOrder = 0x0200;
    private static readonly IntPtr HwndTopMost = new(-1);
    private readonly DashboardServer _dashboardServer;
    private readonly WebView2 _webView;
    private string? _currentMatchId;
    private string? _loadedMatchId;
    private bool _webViewReady;
    private bool _userPositioned;

    public MatchOverlayForm(DashboardServer dashboardServer)
    {
        _dashboardServer = dashboardServer;
        Text = "FACEIT Scout Match Overlay";
        Width = OverlayWidth;
        Height = OverlayHeight;
        StartPosition = FormStartPosition.Manual;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.Lime;
        TransparencyKey = Color.Lime;

        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.Transparent,
        };
        Controls.Add(_webView);

        Shown += async (_, _) => await InitializeWebViewAsync();
    }

    public bool AllowClose { get; set; }
    public bool HasMatch => _currentMatchId is not null;

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            CreateParams parameters = base.CreateParams;
            parameters.ExStyle |=
                WsExToolWindow |
                WsExNoActivate;
            return parameters;
        }
    }

    public void PrepareMatch(string matchId)
    {
        bool matchChanged = !string.Equals(
            _currentMatchId,
            matchId,
            StringComparison.OrdinalIgnoreCase);
        _currentMatchId = matchId;
        EnsureOverlayPosition();

        if (_webViewReady)
        {
            if (matchChanged)
            {
                NavigateToCurrentMatch();
            }
            return;
        }

        if (!Visible)
        {
            Opacity = 0;
            Show();
            Hide();
        }
    }

    public void ShowOverlay()
    {
        if (_currentMatchId is null)
        {
            return;
        }

        EnsureOverlayPosition();
        if (!Visible)
        {
            Show();
        }

        ReassertTopMost();
        NavigateToCurrentMatch();
    }

    public void HideOverlay()
    {
        Hide();
    }

    public void ClearMatch()
    {
        _currentMatchId = null;
        _loadedMatchId = null;
        Hide();
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
                "OverlayWebView2");
            CoreWebView2Environment environment =
                await CoreWebView2Environment.CreateAsync(
                    userDataFolder: userDataDirectory);
            await _webView.EnsureCoreWebView2Async(environment);
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            _webViewReady = true;
            NavigateToCurrentMatch();
            Opacity = 1;
        }
        catch (Exception exception)
        {
            CompanionLog.Write("Match overlay initialization failed", exception);
            Opacity = 1;
            Hide();
        }
    }

    private void NavigateToCurrentMatch()
    {
        if (!_webViewReady ||
            _webView.CoreWebView2 is null ||
            _currentMatchId is null ||
            string.Equals(
                _loadedMatchId,
                _currentMatchId,
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        UriBuilder address = new(_dashboardServer.DashboardUri)
        {
            Path = "/overlay",
            Query = $"match={Uri.EscapeDataString(_currentMatchId)}",
        };
        _webView.CoreWebView2.Navigate(address.Uri.ToString());
        _loadedMatchId = _currentMatchId;
    }

    private void PositionOverlay()
    {
        IntPtr foregroundWindow = GetForegroundWindow();
        Screen targetScreen = foregroundWindow != IntPtr.Zero
            ? Screen.FromHandle(foregroundWindow)
            : Screen.PrimaryScreen ?? Screen.FromControl(this);
        Rectangle screenBounds = targetScreen.Bounds;
        int width = Math.Min(OverlayWidth, screenBounds.Width - 32);
        int height = Math.Min(OverlayHeight, screenBounds.Height - 32);
        int left = screenBounds.Left + ((screenBounds.Width - width) / 2);
        int top = screenBounds.Top + 20;
        Bounds = new Rectangle(left, top, width, height);
    }

    private void EnsureOverlayPosition()
    {
        bool visibleOnAnyScreen = Screen.AllScreens.Any(
            screen => screen.Bounds.IntersectsWith(Bounds));
        if (!_userPositioned || !visibleOnAnyScreen)
        {
            _userPositioned = false;
            PositionOverlay();
        }
    }

    private void OnWebMessageReceived(
        object? sender,
        CoreWebView2WebMessageReceivedEventArgs eventArgs)
    {
        string message;
        try
        {
            message = eventArgs.TryGetWebMessageAsString();
        }
        catch (ArgumentException)
        {
            return;
        }

        if (!string.Equals(
                message,
                "overlay-drag-start",
                StringComparison.Ordinal))
        {
            return;
        }

        _userPositioned = true;
        _ = ReleaseCapture();
        _ = SendMessage(
            Handle,
            WmNcLeftButtonDown,
            new IntPtr(HitTestCaption),
            IntPtr.Zero);
    }

    private void ReassertTopMost()
    {
        if (!IsHandleCreated)
        {
            return;
        }

        _ = SetWindowPos(
            Handle,
            HwndTopMost,
            Left,
            Top,
            Width,
            Height,
            SwpNoActivate | SwpShowWindow | SwpNoOwnerZOrder);
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(
        IntPtr windowHandle,
        int message,
        IntPtr wordParameter,
        IntPtr longParameter);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(
        IntPtr windowHandle,
        IntPtr insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags);

    protected override void OnFormClosing(FormClosingEventArgs eventArgs)
    {
        if (!AllowClose && eventArgs.CloseReason != CloseReason.WindowsShutDown)
        {
            eventArgs.Cancel = true;
            Hide();
            return;
        }

        base.OnFormClosing(eventArgs);
    }
}
