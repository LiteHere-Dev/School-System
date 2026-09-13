# =====================================================================
#  [School Name] System — Ollama Session Launcher (V151)
#  Runs "ollama serve" in this window (so all Ollama startup output,
#  model load activity, and request activity is visible live, exactly
#  like before) while ALSO mirroring everything to a timestamped log
#  file under .\logs\. When this window is closed or the session ends
#  (typed "exit", Ctrl+C, or the console window being closed), a
#  closing summary line is appended to that same log file.
# =====================================================================

$ErrorActionPreference = "Continue"

# --- Match the launcher/server windows: black background, green text ---
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Green"
Clear-Host

# --- Resolve project root & logs folder (works no matter where this
#     script is launched from) ---
$root    = $PSScriptRoot
$logsDir = Join-Path $root "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile   = Join-Path $logsDir "ollama_session_$timestamp.log"

# --- Console-control handler: fires even if the window is closed via
#     the X button (not just typed "exit"/Ctrl+C), so the closing
#     summary line still gets written in the vast majority of cases. ---
Add-Type -Name Win32CloseHandler -Namespace Ollama -MemberDefinition @"
    public delegate bool HandlerRoutine(int CtrlType);
    [System.Runtime.InteropServices.DllImport("Kernel32")]
    public static extern bool SetConsoleCtrlHandler(HandlerRoutine handler, bool add);
"@

$script:LogFileForHandler = $logFile
$handler = {
    param($ctrlType)
    Add-Content -Path $script:LogFileForHandler -Value ""
    Add-Content -Path $script:LogFileForHandler -Value "=== Ollama session ended: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (reason: window closed) ==="
    return $false
}
[Ollama.Win32CloseHandler]::SetConsoleCtrlHandler($handler, $true) | Out-Null

Write-Host "========================================"
Write-Host "  Ollama Server"
Write-Host "  Session log: $logFile"
Write-Host "========================================"
Write-Host ""

Add-Content -Path $logFile -Value "=== Ollama session started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
Add-Content -Path $logFile -Value ""

try {
    # Tee-Object shows output on screen live AND writes it to the log
    # file live, line by line, as ollama produces it.
    ollama serve 2>&1 | Tee-Object -FilePath $logFile -Append
}
finally {
    # Covers normal exit (typed "exit", Ctrl+C). The CtrlType handler
    # above covers the window-closed-via-X case.
    Add-Content -Path $logFile -Value ""
    Add-Content -Path $logFile -Value "=== Ollama session ended: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
}
