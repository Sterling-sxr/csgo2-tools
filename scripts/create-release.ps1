param(
    [string]$FaceitApiBaseUrl = ""
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$distRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "dist"))
$packagePath = [System.IO.Path]::GetFullPath(
    (Join-Path $distRoot "companion-win-x64"))
$packageJson = Get-Content -LiteralPath (Join-Path $repositoryRoot "package.json") -Raw |
    ConvertFrom-Json
$version = [string]$packageJson.version

if ([string]::IsNullOrWhiteSpace($version)) {
    throw "package.json does not contain a version."
}

$archivePath = [System.IO.Path]::GetFullPath(
    (Join-Path $distRoot "CS2FaceitCompanion-v$version-win-x64.zip"))

if (-not $archivePath.StartsWith(
        $distRoot + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Release archive must resolve inside the repository dist directory."
}

Push-Location $repositoryRoot

try {
    & (Join-Path $PSScriptRoot "publish-windows.ps1") `
        -FaceitApiBaseUrl $FaceitApiBaseUrl

    if (-not (Test-Path -LiteralPath $packagePath)) {
        throw "The Windows package was not created."
    }

    $environmentFiles = Get-ChildItem -LiteralPath $packagePath `
        -Recurse `
        -Force `
        -File | Where-Object { $_.Name -like ".env*" }
    if ($environmentFiles) {
        throw "Release package contains an environment file."
    }

    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }

    Compress-Archive -Path (Join-Path $packagePath "*") `
        -DestinationPath $archivePath `
        -CompressionLevel Optimal

    Write-Output "Release archive created at: $archivePath"
}
finally {
    Pop-Location
}
