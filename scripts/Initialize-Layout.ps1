#requires -Version 7.0
<##
.SYNOPSIS
Restores the reserved ForgeDesk directory layout after a fresh checkout.
.DESCRIPTION
Creates missing directories under the project root. Does not overwrite files,
download dependencies, delete data, or modify the machine environment.
##>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$directories = @(
    'apps/windows',
    'apps/web',
    'core/include/forgedesk',
    'core/src',
    'modules',
    'platform/windows',
    'platform/web',
    'ui/src',
    'ui/styles',
    'ui/assets',
    'database',
    'tests/unit',
    'tests/integration',
    'cmake',
    'scripts',
    'third_party',
    'packaging',
    'docs/architecture',
    'docs/development',
    'docs/modules',
    'docs/decisions',
    '.github/workflows'
)

foreach ($relativePath in $directories)
{
    $targetPath = Join-Path $projectRoot $relativePath
    if (Test-Path -LiteralPath $targetPath)
    {
        if (-not (Test-Path -LiteralPath $targetPath -PathType Container))
        {
            throw "Expected a directory, found a file: $relativePath"
        }
    }
    else
    {
        New-Item -ItemType Directory -Path $targetPath | Out-Null
    }
}

Write-Output "ForgeDesk layout ready: $($directories.Count) directory entries checked."
