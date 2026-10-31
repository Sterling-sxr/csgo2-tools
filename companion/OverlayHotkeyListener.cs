using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace CS2FaceitCompanion;

internal sealed class OverlayHotkeyListener : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x0100;
    private const int WmKeyUp = 0x0101;
    private const int WmSysKeyDown = 0x0104;
    private const int WmSysKeyUp = 0x0105;
    private Keys _hotkey;
    private readonly LowLevelKeyboardProcedure _procedure;
    private IntPtr _hookHandle;
    private bool _pressed;

    public OverlayHotkeyListener(Keys hotkey)
    {
        _hotkey = hotkey;
        _procedure = HandleKeyboardMessage;

        using Process process = Process.GetCurrentProcess();
        using ProcessModule? module = process.MainModule;
        IntPtr moduleHandle = GetModuleHandle(module?.ModuleName);
        _hookHandle = SetWindowsHookEx(
            WhKeyboardLl,
            _procedure,
            moduleHandle,
            0);

        if (_hookHandle == IntPtr.Zero)
        {
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "Windows could not register the overlay hold key.");
        }
    }

    public event Action? Pressed;
    public event Action? Released;
    public Func<bool>? ShouldHandle { get; set; }

    public void UpdateHotkey(Keys hotkey)
    {
        _pressed = false;
        _hotkey = hotkey;
    }

    public void Dispose()
    {
        if (_hookHandle == IntPtr.Zero)
        {
            return;
        }

        UnhookWindowsHookEx(_hookHandle);
        _hookHandle = IntPtr.Zero;
        GC.SuppressFinalize(this);
    }

    private IntPtr HandleKeyboardMessage(
        int code,
        IntPtr wordParameter,
        IntPtr longParameter)
    {
        if (code < 0)
        {
            return CallNextHookEx(
                _hookHandle,
                code,
                wordParameter,
                longParameter);
        }

        KeyboardHookData data = Marshal.PtrToStructure<KeyboardHookData>(
            longParameter);
        if (data.VirtualKeyCode != (uint)_hotkey)
        {
            return CallNextHookEx(
                _hookHandle,
                code,
                wordParameter,
                longParameter);
        }

        int message = wordParameter.ToInt32();
        bool keyDown = message is WmKeyDown or WmSysKeyDown;
        bool keyUp = message is WmKeyUp or WmSysKeyUp;
        bool shouldHandle = ShouldHandle?.Invoke() ?? true;

        if (keyDown && shouldHandle)
        {
            if (!_pressed)
            {
                _pressed = true;
                Pressed?.Invoke();
            }

            return (IntPtr)1;
        }

        if (keyUp && _pressed)
        {
            _pressed = false;
            Released?.Invoke();
            return (IntPtr)1;
        }

        return CallNextHookEx(
            _hookHandle,
            code,
            wordParameter,
            longParameter);
    }

    private delegate IntPtr LowLevelKeyboardProcedure(
        int code,
        IntPtr wordParameter,
        IntPtr longParameter);

    [StructLayout(LayoutKind.Sequential)]
    private readonly struct KeyboardHookData
    {
        public readonly uint VirtualKeyCode;
        public readonly uint ScanCode;
        public readonly uint Flags;
        public readonly uint Time;
        public readonly UIntPtr ExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(
        int hookId,
        LowLevelKeyboardProcedure procedure,
        IntPtr moduleHandle,
        uint threadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hookHandle);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(
        IntPtr hookHandle,
        int code,
        IntPtr wordParameter,
        IntPtr longParameter);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string? moduleName);
}
