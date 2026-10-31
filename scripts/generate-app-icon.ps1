param(
    [string]$OutputPath = "companion/Assets/faceit-scout.ico"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputPath))
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "companion/Assets"))

if (-not $resolvedOutput.StartsWith(
        $assetRoot + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputPath must resolve inside companion/Assets."
}

New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
Add-Type -AssemblyName System.Drawing

function New-ReticlePng([int]$Size) {
    $bitmap = New-Object System.Drawing.Bitmap(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $margin = [Math]::Max(1.0, $Size * 0.075)
    $diameter = $Size - (2 * $margin)
    $circle = New-Object System.Drawing.RectangleF($margin, $margin, $diameter, $diameter)
    $graphics.FillEllipse([System.Drawing.Brushes]::White, $circle)

    $outlineWidth = [Math]::Max(1.0, $Size * 0.055)
    $outline = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 27, 30, 35), $outlineWidth)
    $graphics.DrawEllipse($outline, $circle)

    $center = $Size / 2.0
    $innerEdge = $margin + ($outlineWidth * 0.55)
    $gap = [Math]::Max(2.0, $Size * 0.055)
    $lineWidth = [Math]::Max(1.0, $Size * 0.018)
    $line = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 23, 25, 30), $lineWidth)

    $graphics.DrawLine($line, $center, $innerEdge, $center, $center - $gap)
    $graphics.DrawLine($line, $center, $center + $gap, $center, $Size - $innerEdge)
    $graphics.DrawLine($line, $innerEdge, $center, $center - $gap, $center)
    $graphics.DrawLine($line, $center + $gap, $center, $Size - $innerEdge, $center)

    if ($Size -ge 32) {
        $tick = New-Object System.Drawing.Pen(
            [System.Drawing.Color]::FromArgb(255, 23, 25, 30),
            [Math]::Max(1.0, $Size * 0.008))
        $step = $Size * 0.033
        for ($index = 1; $index -le 6; $index++) {
            $distance = $gap + ($index * $step)
            $tickHalf = if ($index % 3 -eq 0) { $Size * 0.034 } else { $Size * 0.023 }
            $graphics.DrawLine($tick, $center - $tickHalf, $center - $distance, $center + $tickHalf, $center - $distance)
            $graphics.DrawLine($tick, $center - $tickHalf, $center + $distance, $center + $tickHalf, $center + $distance)
            $graphics.DrawLine($tick, $center - $distance, $center - $tickHalf, $center - $distance, $center + $tickHalf)
            $graphics.DrawLine($tick, $center + $distance, $center - $tickHalf, $center + $distance, $center + $tickHalf)
        }
        $tick.Dispose()
    }

    $centerWidth = [Math]::Max(1.0, $Size * 0.018)
    $centerLength = [Math]::Max(3.0, $Size * 0.075)
    $centerPen = New-Object System.Drawing.Pen(
        [System.Drawing.Color]::FromArgb(255, 23, 25, 30),
        $centerWidth)
    $graphics.DrawLine($centerPen, $center - $centerLength / 2, $center, $center + $centerLength / 2, $center)
    $graphics.DrawLine($centerPen, $center, $center - $centerLength / 2, $center, $center + $centerLength / 2)

    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $stream.ToArray()

    $stream.Dispose()
    $centerPen.Dispose()
    $line.Dispose()
    $outline.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Output -NoEnumerate $bytes
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = [System.Collections.Generic.List[byte[]]]::new()
foreach ($size in $sizes) {
    $images.Add((New-ReticlePng $size))
}
$stream = [System.IO.File]::Open($resolvedOutput, [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($stream)

try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$sizes.Count)
    $offset = 6 + (16 * $sizes.Count)

    for ($index = 0; $index -lt $sizes.Count; $index++) {
        $size = $sizes[$index]
        $image = $images[$index]
        $writer.Write([Byte]$(if ($size -eq 256) { 0 } else { $size }))
        $writer.Write([Byte]$(if ($size -eq 256) { 0 } else { $size }))
        $writer.Write([Byte]0)
        $writer.Write([Byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$image.Length)
        $writer.Write([UInt32]$offset)
        $offset += $image.Length
    }

    foreach ($image in $images) {
        $writer.Write($image)
    }
}
finally {
    $writer.Dispose()
    $stream.Dispose()
}

Write-Output "Generated application icon: $resolvedOutput"
