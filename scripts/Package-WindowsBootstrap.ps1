#requires -Version 7.0
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $root 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw 'Invalid VERSION'
}
$program = Join-Path $root 'build/windows-msvc-release/Release/forgedesk_bootstrap.exe'
if (-not (Test-Path -LiteralPath $program -PathType Leaf)) {
    throw 'Build the windows-msvc-release preset first.'
}
$metadata = & $program
if ($LASTEXITCODE -ne 0 -or "Version: $version" -notin $metadata -or 'Build: Release' -notin $metadata) {
    throw 'Bootstrap does not match the release configuration and VERSION.'
}
$output = Join-Path $root 'dist/release'
New-Item -Path $output -ItemType Directory -Force | Out-Null
$archive = Join-Path $output "ForgeDesk-$version-windows-x64-bootstrap.zip"
if (Test-Path -LiteralPath $archive) {
    throw "Archive already exists: $archive"
}
$items = @($program, (Join-Path $root 'LICENSE'), (Join-Path $root 'NOTICE'),
    (Join-Path $root 'packaging/windows/BOOTSTRAP.md'))
Compress-Archive -LiteralPath $items -DestinationPath $archive
Get-FileHash -LiteralPath $archive -Algorithm SHA256
