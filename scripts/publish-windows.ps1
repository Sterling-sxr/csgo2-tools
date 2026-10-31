param(
    [string]$OutputDirectory = "dist/companion-win-x64",
    [string]$FaceitApiBaseUrl = ""
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot ".."))
$distRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $repositoryRoot "dist"))
$outputPath = [System.IO.Path]::GetFullPath(
    (Join-Path $repositoryRoot $OutputDirectory))

if (-not $outputPath.StartsWith(
        $distRoot + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputDirectory must resolve inside the repository dist directory."
}

Push-Location $repositoryRoot

try {
    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Recurse -Force
    }

    pnpm build
    if ($LASTEXITCODE -ne 0) {
        throw "Next.js build failed."
    }

    dotnet publish companion/Cs2FaceitCompanion.csproj `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -o $outputPath
    if ($LASTEXITCODE -ne 0) {
        throw ".NET publish failed."
    }

    $webPath = Join-Path $outputPath "web"
    New-Item -ItemType Directory -Path $webPath -Force | Out-Null
    Copy-Item -Path ".next/standalone/*" -Destination $webPath -Recurse -Force

    # Next.js standalone copies local environment files into its output. They
    # must never be shipped in a public desktop package, even though the app
    # now uses the public cloud API URL from companion.settings.json.
    foreach ($environmentFileName in @(
            ".env",
            ".env.local",
            ".env.production",
            ".env.production.local")) {
        $environmentFilePath = Join-Path $webPath $environmentFileName
        if (Test-Path -LiteralPath $environmentFilePath) {
            Remove-Item -LiteralPath $environmentFilePath -Force
        }
    }

    # pnpm's standalone output uses Windows junctions. Flatten the traced
    # virtual-store packages so the published directory remains relocatable.
    $standaloneStore = ".next/standalone/node_modules/.pnpm"
    foreach ($storeEntry in Get-ChildItem $standaloneStore -Directory) {
        if ($storeEntry.Name -eq "node_modules") {
            continue
        }

        $packageRoot = Join-Path $storeEntry.FullName "node_modules"
        if (-not (Test-Path -LiteralPath $packageRoot)) {
            continue
        }

        foreach ($packageEntry in Get-ChildItem $packageRoot -Directory) {
            if ($packageEntry.Name.StartsWith("@")) {
                foreach ($scopedPackage in Get-ChildItem $packageEntry.FullName -Directory) {
                    $scopeDestination = Join-Path `
                        (Join-Path $webPath "node_modules") `
                        $packageEntry.Name
                    $packageDestination = Join-Path `
                        $scopeDestination `
                        $scopedPackage.Name
                    New-Item -ItemType Directory `
                        -Path $packageDestination `
                        -Force | Out-Null
                    Copy-Item -Path "$($scopedPackage.FullName)/*" `
                        -Destination $packageDestination `
                        -Recurse `
                        -Force
                }
            }
            else {
                $packageDestination = Join-Path `
                    (Join-Path $webPath "node_modules") `
                    $packageEntry.Name
                New-Item -ItemType Directory `
                    -Path $packageDestination `
                    -Force | Out-Null
                Copy-Item -Path "$($packageEntry.FullName)/*" `
                    -Destination $packageDestination `
                    -Recurse `
                    -Force
            }
        }
    }

    $staticDestination = Join-Path $webPath ".next/static"
    New-Item -ItemType Directory -Path $staticDestination -Force | Out-Null
    Copy-Item -Path ".next/static/*" -Destination $staticDestination -Recurse -Force

    $nodePath = (Get-Command node -ErrorAction Stop).Source
    Copy-Item -LiteralPath $nodePath -Destination (Join-Path $webPath "node.exe")

    $publishedSettingsPath = Join-Path $outputPath "companion.settings.json"
    if (-not [string]::IsNullOrWhiteSpace($FaceitApiBaseUrl)) {
        $parsedApiUri = $null
        if (-not [System.Uri]::TryCreate(
                $FaceitApiBaseUrl,
                [System.UriKind]::Absolute,
                [ref]$parsedApiUri) -or
            $parsedApiUri.Scheme -ne [System.Uri]::UriSchemeHttps) {
            throw "FaceitApiBaseUrl must be an absolute HTTPS URL."
        }

        $publishedSettings = Get-Content -LiteralPath $publishedSettingsPath -Raw |
            ConvertFrom-Json
        $publishedSettings.faceitApiBaseUrl = $FaceitApiBaseUrl.TrimEnd('/')
        $publishedSettings | ConvertTo-Json -Depth 10 |
            Set-Content -LiteralPath $publishedSettingsPath -Encoding utf8
        Write-Output "Configured cloud FACEIT API: $FaceitApiBaseUrl"
    }
    else {
        $publishedSettings = Get-Content -LiteralPath $publishedSettingsPath -Raw |
            ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($publishedSettings.faceitApiBaseUrl)) {
            Write-Warning "No FaceitApiBaseUrl was supplied. The package contains no FACEIT API key and data lookup will require a cloud API URL."
        }
        else {
            Write-Output "Using cloud FACEIT API from companion.settings.json: $($publishedSettings.faceitApiBaseUrl)"
        }
    }

    Copy-Item -LiteralPath "README.md" -Destination (Join-Path $outputPath "README.md")
    Copy-Item -LiteralPath "CHANGELOG.md" -Destination (Join-Path $outputPath "CHANGELOG.md")

    Write-Output "Windows desktop package created at: $outputPath"
}
finally {
    Pop-Location
}
